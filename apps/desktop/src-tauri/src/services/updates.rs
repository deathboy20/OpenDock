//! Update checks: once a day, ask GitHub for the latest OpenDock release and say when a newer
//! one exists. Only `api.github.com` is contacted, through `net.rs`, with no identifiers; the
//! user downloads the installer from the release page. See ADR 0006.

use serde::Serialize;
use serde_json::Value;

use crate::net::{self, Request};
use crate::store::{now_ms, Database};

pub const WIDGET: &str = "updates";
pub const HOST: &str = "api.github.com";
const REPO: &str = "deathboy20/OpenDock";
const RELEASES_PAGE: &str = "https://github.com/deathboy20/OpenDock/releases/";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub version: String,
    pub name: String,
    pub url: String,
    pub published_at: Option<i64>,
    /// The start of the release notes, as plain text.
    pub notes: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current: String,
    pub latest: Option<Release>,
    pub available: bool,
    pub checked_at: Option<i64>,
    pub error: Option<String>,
}

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// `1.2.3`, `v1.2.3` or `1.2.3-beta.1` as comparable numbers. A pre-release sorts before its
/// release, so `0.4.0-beta` is older than `0.4.0`.
pub fn parse_version(text: &str) -> Option<(u64, u64, u64, bool)> {
    let text = text.trim().trim_start_matches('v');
    let (core, pre) = match text.split_once('-') {
        Some((core, _)) => (core, true),
        None => (text, false),
    };
    let mut parts = core.split('.').map(|p| p.parse::<u64>().ok());
    let version = (parts.next()??, parts.next()??, parts.next()??, pre);
    parts.next().is_none().then_some(version)
}

pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (parse_version(candidate), parse_version(current)) {
        (Some((a, b, c, a_pre)), Some((x, y, z, x_pre))) => {
            (a, b, c) > (x, y, z) || ((a, b, c) == (x, y, z) && x_pre && !a_pre)
        }
        _ => false,
    }
}

/// Reads `GET /repos/{repo}/releases/latest`, which leaves out drafts and pre-releases.
pub fn parse_release(body: &str) -> Result<Release, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let tag = value["tag_name"]
        .as_str()
        .ok_or_else(|| "GitHub sent no release".to_string())?;
    if parse_version(tag).is_none() {
        return Err(format!(
            "the latest release has an unexpected version: {tag}"
        ));
    }
    let url = value["html_url"]
        .as_str()
        .filter(|u| u.starts_with(RELEASES_PAGE))
        .unwrap_or(RELEASES_PAGE)
        .to_string();
    let notes: String = value["body"]
        .as_str()
        .unwrap_or_default()
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .chars()
        .take(600)
        .collect();
    Ok(Release {
        version: tag.trim_start_matches('v').to_string(),
        name: value["name"]
            .as_str()
            .filter(|n| !n.is_empty())
            .unwrap_or(tag)
            .chars()
            .take(120)
            .collect(),
        url,
        published_at: value["published_at"]
            .as_str()
            .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
            .map(|t| t.timestamp_millis()),
        notes,
    })
}

pub fn check(db: &Database) -> UpdateStatus {
    let url = format!("https://{HOST}/repos/{REPO}/releases/latest");
    let headers = [
        ("Accept", "application/vnd.github+json"),
        ("X-GitHub-Api-Version", "2022-11-28"),
    ];
    let result = net::send(
        db,
        &Request {
            headers: &headers,
            ..Request::get(WIDGET, &[HOST], &url)
        },
    )
    .and_then(|body| parse_release(&body));
    let current = current_version().to_string();
    match result {
        Ok(release) => UpdateStatus {
            available: is_newer(&release.version, &current),
            current,
            latest: Some(release),
            checked_at: Some(now_ms()),
            error: None,
        },
        Err(error) => UpdateStatus {
            current,
            checked_at: Some(now_ms()),
            error: Some(if error.ends_with("answered 404") {
                "No release has been published yet".into()
            } else {
                error
            }),
            ..Default::default()
        },
    }
}

/// The page the user downloads from: the release's own page, or the releases list.
pub fn download_page(status: &UpdateStatus) -> String {
    status
        .latest
        .as_ref()
        .map(|r| r.url.clone())
        .filter(|u| u.starts_with(RELEASES_PAGE))
        .unwrap_or_else(|| format!("{RELEASES_PAGE}latest"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_newer("0.4.0", "0.3.0"));
        assert!(is_newer("v1.0.0", "0.9.9"));
        assert!(is_newer("0.3.1", "0.3.0"));
        assert!(is_newer("0.4.0", "0.4.0-beta.1"));
        assert!(!is_newer("0.4.0-beta.1", "0.4.0"));
        assert!(!is_newer("0.3.0", "0.3.0"));
        assert!(!is_newer("0.2.9", "0.3.0"));
        assert!(!is_newer("nightly", "0.3.0"));
        assert_eq!(parse_version("1.2"), None);
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn reads_the_latest_release() {
        let release = parse_release(
            r###"{"tag_name":"v0.4.0","name":"OpenDock 0.4.0","html_url":"https://github.com/deathboy20/OpenDock/releases/tag/v0.4.0",
                "published_at":"2026-12-01T09:00:00Z","body":"## Added\r\n\r\n- Skins\r\n- Scenes"}"###,
        )
        .unwrap();
        assert_eq!(release.version, "0.4.0");
        assert_eq!(release.name, "OpenDock 0.4.0");
        assert_eq!(release.notes, "## Added\n- Skins\n- Scenes");
        assert!(release.published_at.is_some());
    }

    #[test]
    fn only_trusts_links_to_this_repository() {
        let release = parse_release(
            r#"{"tag_name":"v9.9.9","html_url":"https://evil.example/download.exe"}"#,
        )
        .unwrap();
        assert_eq!(release.url, RELEASES_PAGE);
        let status = UpdateStatus {
            latest: Some(release),
            ..Default::default()
        };
        assert!(download_page(&status).starts_with(RELEASES_PAGE));
        assert!(parse_release(r#"{"tag_name":"latest"}"#).is_err());
        assert!(parse_release(r#"{"message":"Not Found"}"#).is_err());
    }
}
