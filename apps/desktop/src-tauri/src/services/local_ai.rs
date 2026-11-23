//! The Local AI widget: whether Ollama is running on this PC, the models it has, the ones
//! loaded in memory, and a one-line prompt to a chosen model. Every request goes to
//! `127.0.0.1:11434` through `net.rs`, so nothing leaves the machine and the Privacy Ledger
//! shows each one.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};

use crate::net::{self, Request};
use crate::store::{now_ms, Database};

pub const WIDGET: &str = "local-ai";
pub const HOST: &str = "127.0.0.1";
const BASE: &str = "http://127.0.0.1:11434";
pub const MAX_PROMPT_CHARS: usize = 2000;
const MAX_ANSWER_CHARS: usize = 12_000;
const ASK_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalModel {
    pub name: String,
    pub size_bytes: u64,
    pub family: Option<String>,
    pub parameter_size: Option<String>,
    pub quantization: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoadedModel {
    pub name: String,
    pub size_vram_bytes: u64,
    /// When Ollama will unload it, as Ollama reports it (RFC 3339).
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalAiSnapshot {
    pub running: bool,
    pub models: Vec<LocalModel>,
    pub loaded: Vec<LoadedModel>,
    /// Set when Ollama answered but something went wrong; a stopped Ollama is not an error.
    pub error: Option<String>,
    pub checked_at: i64,
}

fn text(value: &Value) -> Option<String> {
    value
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(200).collect())
}

pub fn parse_tags(body: &str) -> Result<Vec<LocalModel>, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let mut models: Vec<LocalModel> = value["models"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|m| {
                    Some(LocalModel {
                        name: text(&m["name"])?,
                        size_bytes: m["size"].as_u64().unwrap_or(0),
                        family: text(&m["details"]["family"]),
                        parameter_size: text(&m["details"]["parameter_size"]),
                        quantization: text(&m["details"]["quantization_level"]),
                    })
                })
                .take(100)
                .collect()
        })
        .unwrap_or_default();
    models.sort_by_key(|m| m.name.to_lowercase());
    Ok(models)
}

pub fn parse_ps(body: &str) -> Result<Vec<LoadedModel>, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    Ok(value["models"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|m| {
                    Some(LoadedModel {
                        name: text(&m["name"])?,
                        size_vram_bytes: m["size_vram"].as_u64().unwrap_or(0),
                        expires_at: text(&m["expires_at"]),
                    })
                })
                .take(20)
                .collect()
        })
        .unwrap_or_default())
}

fn is_connection_error(error: &str) -> bool {
    error.starts_with("could not reach")
}

pub fn check(db: &Database) -> LocalAiSnapshot {
    let mut snapshot = LocalAiSnapshot {
        checked_at: now_ms(),
        ..Default::default()
    };
    let tags_url = format!("{BASE}/api/tags");
    match net::get_text(db, WIDGET, &[HOST], &tags_url).and_then(|b| parse_tags(&b)) {
        Ok(models) => {
            snapshot.running = true;
            snapshot.models = models;
        }
        Err(error) if is_connection_error(&error) => return snapshot,
        Err(error) => {
            snapshot.running = true;
            snapshot.error = Some(error);
            return snapshot;
        }
    }
    let ps_url = format!("{BASE}/api/ps");
    match net::get_text(db, WIDGET, &[HOST], &ps_url).and_then(|b| parse_ps(&b)) {
        Ok(loaded) => snapshot.loaded = loaded,
        Err(error) => snapshot.error = Some(error),
    }
    snapshot
}

pub fn parse_answer(body: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    if let Some(error) = value["error"].as_str() {
        return Err(format!(
            "Ollama: {}",
            error.chars().take(300).collect::<String>()
        ));
    }
    let answer = value["response"]
        .as_str()
        .ok_or_else(|| "Ollama sent no answer".to_string())?;
    let mut answer: String = answer.trim().chars().take(MAX_ANSWER_CHARS).collect();
    // Reasoning models put their working in <think> tags; the panel shows the answer.
    if let Some(end) = answer.find("</think>") {
        answer = answer[end + "</think>".len()..].trim().to_string();
    }
    Ok(answer)
}

/// One prompt at a time, so a long answer can't queue up more work on the GPU.
static ASKING: AtomicBool = AtomicBool::new(false);

pub fn ask(db: &Database, model: &str, prompt: &str) -> Result<String, String> {
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err("Type a question first".into());
    }
    if prompt.chars().count() > MAX_PROMPT_CHARS {
        return Err(format!(
            "A prompt can be at most {MAX_PROMPT_CHARS} characters"
        ));
    }
    if ASKING.swap(true, Ordering::SeqCst) {
        return Err("Still answering the last question".into());
    }
    let body = json!({ "model": model, "prompt": prompt, "stream": false }).to_string();
    let url = format!("{BASE}/api/generate");
    let result = net::send(
        db,
        &Request {
            json_body: Some(&body),
            timeout: ASK_TIMEOUT,
            ..Request::get(WIDGET, &[HOST], &url)
        },
    )
    .and_then(|b| parse_answer(&b));
    ASKING.store(false, Ordering::SeqCst);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_installed_models() {
        let models = parse_tags(
            r#"{"models":[
                {"name":"qwen3:4b","size":2497281474,"details":{"family":"qwen3","parameter_size":"4.0B","quantization_level":"Q4_K_M"}},
                {"name":"Llama3:8b","size":1,"details":{}},
                {"size":5}
            ]}"#,
        )
        .unwrap();
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].name, "Llama3:8b");
        assert_eq!(models[1].parameter_size.as_deref(), Some("4.0B"));
        assert_eq!(models[1].quantization.as_deref(), Some("Q4_K_M"));
        assert_eq!(models[0].family, None);
        assert!(parse_tags("not json").is_err());
        assert!(parse_tags("{}").unwrap().is_empty());
    }

    #[test]
    fn parses_loaded_models() {
        let loaded = parse_ps(
            r#"{"models":[{"name":"qwen3:4b","size_vram":3000000000,"expires_at":"2026-11-23T12:00:00Z"}]}"#,
        )
        .unwrap();
        assert_eq!(loaded[0].size_vram_bytes, 3_000_000_000);
        assert_eq!(
            loaded[0].expires_at.as_deref(),
            Some("2026-11-23T12:00:00Z")
        );
    }

    #[test]
    fn reads_answers_and_errors() {
        assert_eq!(
            parse_answer(r#"{"response":"  <think>hmm</think>\n\nHello there  ","done":true}"#)
                .unwrap(),
            "Hello there"
        );
        assert_eq!(
            parse_answer(r#"{"error":"model 'x' not found"}"#).unwrap_err(),
            "Ollama: model 'x' not found"
        );
        assert!(parse_answer(r#"{"done":true}"#).is_err());
    }

    #[test]
    fn checks_prompts_before_any_request() {
        let db = Database::open_in_memory().unwrap();
        assert!(ask(&db, "m", "   ").is_err());
        assert!(ask(&db, "m", &"x".repeat(MAX_PROMPT_CHARS + 1)).is_err());
        assert_eq!(
            db.with(crate::store::cache::ledger).unwrap().len(),
            0,
            "nothing was sent"
        );
    }
}
