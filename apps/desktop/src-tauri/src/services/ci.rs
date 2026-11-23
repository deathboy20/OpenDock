//! The CI status widget: the latest GitHub Actions run for each repository the user lists.
//! It is off until the user turns it on, talks only to `api.github.com` through `net.rs`,
//! and keeps the optional token in the OS keychain.

use chrono::DateTime;
use serde::Serialize;
use serde_json::Value;

use crate::net::{self, Request};
use crate::secrets;
use crate::store::{now_ms, Database};

pub const WIDGET: &str = "ci";
pub const HOST: &str = "api.github.com";
const TOKEN_ACCOUNT: &str = "github:token";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CiRun {
    pub workflow: String,
    pub branch: String,
    pub event: String,
    /// `queued`, `in_progress`, `completed` and so on, as GitHub reports it.
    pub status: String,
    /// `success`, `failure`, `cancelled` and so on, once the run has completed.
    pub conclusion: Option<String>,
    pub url: String,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CiRepoStatus {
    pub repo: String,
    pub run: Option<CiRun>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CiSnapshot {
    pub enabled: bool,
    pub has_token: bool,
    pub repos: Vec<CiRepoStatus>,
    pub checked_at: i64,
}

fn text(value: &Value, max: usize) -> Option<String> {
    value
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(max).collect())
}

/// The newest run from `GET /repos/{owner}/{repo}/actions/runs?per_page=1`.
pub fn parse_runs(body: &str) -> Result<Option<CiRun>, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let Some(runs) = value["workflow_runs"].as_array() else {
        return Err("GitHub sent an unexpected answer".into());
    };
    let Some(run) = runs.first() else {
        return Ok(None);
    };
    // Only links back to github.com are passed on, since the panel opens them.
    let url = text(&run["html_url"], 500)
        .filter(|u| u.starts_with("https://github.com/"))
        .unwrap_or_default();
    Ok(Some(CiRun {
        workflow: text(&run["name"], 120).unwrap_or_else(|| "Workflow".into()),
        branch: text(&run["head_branch"], 120).unwrap_or_default(),
        event: text(&run["event"], 40).unwrap_or_default(),
        status: text(&run["status"], 40).unwrap_or_else(|| "unknown".into()),
        conclusion: text(&run["conclusion"], 40),
        url,
        updated_at: run["updated_at"]
            .as_str()
            .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
            .map(|t| t.timestamp_millis()),
    }))
}

fn explain(error: String) -> String {
    if error.ends_with("answered 404") {
        "Not found. Check the name, or add a token for a private repository".into()
    } else if error.ends_with("answered 401") {
        "GitHub rejected the token".into()
    } else if error.ends_with("answered 403") || error.ends_with("answered 429") {
        "GitHub's rate limit was reached; add a token or wait an hour".into()
    } else {
        error
    }
}

pub fn token() -> Option<String> {
    secrets::get(TOKEN_ACCOUNT).ok().flatten()
}

/// GitHub tokens are letters, digits and underscores (`ghp_…`, `github_pat_…`).
pub fn is_plausible_token(token: &str) -> bool {
    (20..=255).contains(&token.len())
        && token.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn set_token(token: &str) -> Result<(), String> {
    let token = token.trim();
    if !is_plausible_token(token) {
        return Err("That doesn't look like a GitHub token".into());
    }
    secrets::set(TOKEN_ACCOUNT, token).map_err(|_| "couldn't save the token in the keychain".into())
}

pub fn clear_token() -> Result<(), String> {
    secrets::delete(TOKEN_ACCOUNT).map_err(|_| "couldn't remove the token".into())
}

pub fn check(db: &Database, repos: &[String], token: Option<&str>) -> CiSnapshot {
    let auth = token.map(|t| format!("Bearer {t}"));
    let mut headers: Vec<(&str, &str)> = vec![
        ("Accept", "application/vnd.github+json"),
        ("X-GitHub-Api-Version", "2022-11-28"),
    ];
    if let Some(auth) = &auth {
        headers.push(("Authorization", auth));
    }
    let repos = repos
        .iter()
        .map(|repo| {
            let url = format!("https://{HOST}/repos/{repo}/actions/runs?per_page=1");
            let result = net::send(
                db,
                &Request {
                    headers: &headers,
                    ..Request::get(WIDGET, &[HOST], &url)
                },
            )
            .and_then(|body| parse_runs(&body));
            match result {
                Ok(run) => CiRepoStatus {
                    repo: repo.clone(),
                    run,
                    error: None,
                },
                Err(error) => CiRepoStatus {
                    repo: repo.clone(),
                    run: None,
                    error: Some(explain(error)),
                },
            }
        })
        .collect();
    CiSnapshot {
        enabled: true,
        has_token: token.is_some(),
        repos,
        checked_at: now_ms(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_latest_run() {
        let run = parse_runs(
            r#"{"total_count":2,"workflow_runs":[{
                "name":"CI","head_branch":"main","event":"pull_request","status":"completed",
                "conclusion":"failure","html_url":"https://github.com/o/r/actions/runs/1",
                "updated_at":"2026-11-23T10:00:00Z"}]}"#,
        )
        .unwrap()
        .unwrap();
        assert_eq!(run.workflow, "CI");
        assert_eq!(run.conclusion.as_deref(), Some("failure"));
        assert_eq!(run.updated_at, Some(1_795_428_000_000));
        assert_eq!(run.url, "https://github.com/o/r/actions/runs/1");
    }

    #[test]
    fn handles_empty_odd_and_unsafe_answers() {
        assert_eq!(parse_runs(r#"{"workflow_runs":[]}"#).unwrap(), None);
        assert!(parse_runs(r#"{"message":"Not Found"}"#).is_err());
        let run = parse_runs(
            r#"{"workflow_runs":[{"status":"in_progress","conclusion":null,"html_url":"javascript:alert(1)"}]}"#,
        )
        .unwrap()
        .unwrap();
        assert_eq!(run.url, "");
        assert_eq!(run.conclusion, None);
        assert_eq!(run.workflow, "Workflow");
    }

    #[test]
    fn explains_common_github_errors() {
        assert!(explain("api.github.com answered 404".into()).starts_with("Not found"));
        assert!(explain("api.github.com answered 403".into()).contains("rate limit"));
        assert_eq!(explain("offline".into()), "offline");
    }

    #[test]
    fn checks_token_shape() {
        assert!(is_plausible_token(
            "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
        ));
        assert!(is_plausible_token(&format!(
            "github_pat_{}",
            "a".repeat(60)
        )));
        assert!(!is_plausible_token("short"));
        assert!(!is_plausible_token("ghp_abc def ghi jkl mno pqr"));
        assert!(set_token("bad token").is_err());
    }
}
