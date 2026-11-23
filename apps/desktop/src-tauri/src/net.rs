//! The only way OpenDock talks to the network. Every request names the widget making it,
//! must target a host that widget declared, and is written to the Privacy Ledger.

use std::time::Duration;

use crate::store::{cache, Database};

const MAX_BODY_BYTES: u64 = 5 * 1024 * 1024;

pub fn host_of(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    let host = authority.rsplit('@').next()?.split(':').next()?;
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

/// Accepts `webcal://` links, which calendar apps hand out for iCal feeds.
pub fn normalize_feed_url(url: &str) -> String {
    let trimmed = url.trim();
    match trimmed.strip_prefix("webcal://") {
        Some(rest) => format!("https://{rest}"),
        None => trimmed.to_string(),
    }
}

/// Plain `http://` is allowed only for services on this machine, such as Ollama.
pub fn is_loopback(host: &str) -> bool {
    matches!(host, "127.0.0.1" | "localhost" | "[::1]" | "::1")
}

fn agent(timeout: Duration) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(8))
        .timeout(timeout)
        .user_agent(concat!("OpenDock/", env!("CARGO_PKG_VERSION")))
        .build()
}

/// One request a widget wants to make. Headers may carry secrets, so they are never logged.
pub struct Request<'a> {
    pub widget: &'a str,
    pub allowed_hosts: &'a [&'a str],
    pub url: &'a str,
    pub headers: &'a [(&'a str, &'a str)],
    /// A JSON body turns the request into a POST.
    pub json_body: Option<&'a str>,
    pub timeout: Duration,
}

impl<'a> Request<'a> {
    pub fn get(widget: &'a str, allowed_hosts: &'a [&'a str], url: &'a str) -> Self {
        Self {
            widget,
            allowed_hosts,
            url,
            headers: &[],
            json_body: None,
            timeout: Duration::from_secs(20),
        }
    }
}

/// Checks the URL against the widget's declared hosts before any connection is made.
pub fn check_url(widget: &str, allowed_hosts: &[&str], url: &str) -> Result<String, String> {
    let host = host_of(url).ok_or_else(|| "invalid URL".to_string())?;
    let secure = url.starts_with("https://");
    let local = url.starts_with("http://") && is_loopback(&host);
    if !secure && !local {
        return Err("only https:// URLs are allowed".into());
    }
    if !allowed_hosts.iter().any(|h| h.eq_ignore_ascii_case(&host)) {
        return Err(format!("{widget} is not allowed to contact {host}"));
    }
    Ok(host)
}

pub fn send(db: &Database, request: &Request<'_>) -> Result<String, String> {
    let host = check_url(request.widget, request.allowed_hosts, request.url)?;
    let agent = agent(request.timeout);
    let mut call = match request.json_body {
        Some(_) => agent.post(request.url),
        None => agent.get(request.url),
    };
    for (name, value) in request.headers {
        call = call.set(name, value);
    }
    let response = match request.json_body {
        Some(body) => call
            .set("Content-Type", "application/json")
            .send_string(body),
        None => call.call(),
    };
    let result = response
        .map_err(|e| match e {
            ureq::Error::Status(code, _) => format!("{host} answered {code}"),
            ureq::Error::Transport(t) => format!("could not reach {host}: {}", t.kind()),
        })
        .and_then(|response| {
            use std::io::Read;
            let mut body = String::new();
            response
                .into_reader()
                .take(MAX_BODY_BYTES)
                .read_to_string(&mut body)
                .map(|_| body)
                .map_err(|e| e.to_string())
        });
    let _ = db.with(|c| cache::log_request(c, request.widget, &host, result.is_ok()));
    result
}

pub fn get_text(
    db: &Database,
    widget: &str,
    allowed_hosts: &[&str],
    url: &str,
) -> Result<String, String> {
    send(db, &Request::get(widget, allowed_hosts, url))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_hosts() {
        assert_eq!(
            host_of("https://calendar.google.com/calendar/ical/x/basic.ics").as_deref(),
            Some("calendar.google.com")
        );
        assert_eq!(
            host_of("https://user@Example.com:8443/a").as_deref(),
            Some("example.com")
        );
        assert_eq!(host_of("ftp://x"), None);
    }

    #[test]
    fn webcal_becomes_https() {
        assert_eq!(
            normalize_feed_url(" webcal://p01.icloud.com/x "),
            "https://p01.icloud.com/x"
        );
    }

    #[test]
    fn rejects_undeclared_hosts_without_network() {
        let db = Database::open_in_memory().unwrap();
        let err = get_text(
            &db,
            "weather",
            &["api.open-meteo.com"],
            "https://evil.example/x",
        )
        .unwrap_err();
        assert!(err.contains("not allowed"));
        assert!(get_text(
            &db,
            "weather",
            &["api.open-meteo.com"],
            "http://api.open-meteo.com"
        )
        .is_err());
    }

    #[test]
    fn plain_http_only_reaches_declared_loopback_hosts() {
        assert_eq!(
            check_url(
                "local-ai",
                &["127.0.0.1"],
                "http://127.0.0.1:11434/api/tags"
            )
            .as_deref(),
            Ok("127.0.0.1")
        );
        assert!(check_url(
            "local-ai",
            &["127.0.0.1"],
            "http://localhost:11434/api/tags"
        )
        .is_err());
        assert!(check_url("local-ai", &["example.com"], "http://example.com/").is_err());
        assert!(check_url("ci", &["api.github.com"], "https://api.github.com/repos").is_ok());
        assert!(check_url("ci", &["api.github.com"], "https://api.github.com.evil.io/").is_err());
        assert!(check_url("ci", &["api.github.com"], "https://evil.io@api.github.com/").is_ok());
    }
}
