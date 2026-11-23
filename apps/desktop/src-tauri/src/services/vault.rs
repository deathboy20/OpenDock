//! Vault capture: a quick note box that appends to `<vault>/Inbox/YYYY-MM-DD.md` in the
//! user's Obsidian vault. It writes only that one file inside the chosen folder, and refuses
//! to follow links out of it.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Local};
use serde::Serialize;

pub const MAX_CAPTURE_CHARS: usize = 4000;
const INBOX: &str = "Inbox";
const RECENT: usize = 3;

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub configured: bool,
    pub exists: bool,
    /// The folder has an `.obsidian` settings folder, so Obsidian knows it as a vault.
    pub is_obsidian: bool,
    /// Today's capture file, relative to the vault, with forward slashes.
    pub today_file: String,
    pub today_count: u32,
    /// The latest entries in today's file, newest first, without the time stamp.
    pub recent: Vec<String>,
}

pub fn today_name(now: &DateTime<Local>) -> String {
    format!("{}.md", now.format("%Y-%m-%d"))
}

/// One Markdown list item, `- HH:MM text`, with later lines indented under it.
pub fn format_entry(text: &str, now: &DateTime<Local>) -> String {
    let mut lines = text.trim().lines();
    let first = lines.next().unwrap_or_default().trim_end();
    let mut entry = format!("- {} {first}\n", now.format("%H:%M"));
    for line in lines {
        let line = line.trim_end();
        if line.is_empty() {
            entry.push('\n');
        } else {
            entry.push_str("  ");
            entry.push_str(line);
            entry.push('\n');
        }
    }
    entry
}

fn entries(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| line.strip_prefix("- "))
        .map(|rest| {
            // Drop the "HH:MM " stamp the capture box writes.
            let bytes = rest.as_bytes();
            let stamped = bytes.len() > 6
                && bytes[2] == b':'
                && bytes[5] == b' '
                && rest[..2].chars().all(|c| c.is_ascii_digit())
                && rest[3..5].chars().all(|c| c.is_ascii_digit());
            if stamped { &rest[6..] } else { rest }.to_string()
        })
        .collect()
}

fn vault_dir(vault: &str) -> Result<PathBuf, String> {
    if vault.trim().is_empty() {
        return Err("Choose your vault folder first".into());
    }
    let dir = PathBuf::from(vault.trim());
    if !dir.is_absolute() {
        return Err("The vault path must be a full path, like C:\\Users\\you\\Vault".into());
    }
    if !dir.is_dir() {
        return Err(format!("{} isn't a folder", dir.display()));
    }
    Ok(dir)
}

/// A path inside the vault that must be a real folder or file, not a link to elsewhere.
fn not_a_link(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_symlink() => Err(format!(
            "{} is a link; OpenDock only writes inside the vault",
            path.display()
        )),
        _ => Ok(()),
    }
}

pub fn status(vault: &str, now: &DateTime<Local>) -> VaultStatus {
    let today_file = format!("{INBOX}/{}", today_name(now));
    let mut status = VaultStatus {
        configured: !vault.trim().is_empty(),
        today_file,
        ..Default::default()
    };
    let Ok(dir) = vault_dir(vault) else {
        return status;
    };
    status.exists = true;
    status.is_obsidian = dir.join(".obsidian").is_dir();
    let file = dir.join(INBOX).join(today_name(now));
    if not_a_link(&file).is_ok() {
        if let Ok(text) = fs::read_to_string(&file) {
            let all = entries(&text);
            status.today_count = u32::try_from(all.len()).unwrap_or(u32::MAX);
            status.recent = all.into_iter().rev().take(RECENT).collect();
        }
    }
    status
}

pub fn capture(vault: &str, text: &str, now: &DateTime<Local>) -> Result<(), String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Type something to capture".into());
    }
    if trimmed.chars().count() > MAX_CAPTURE_CHARS {
        return Err(format!(
            "A capture can be at most {MAX_CAPTURE_CHARS} characters"
        ));
    }
    let dir = vault_dir(vault)?;
    let inbox = dir.join(INBOX);
    not_a_link(&inbox)?;
    if !inbox.exists() {
        fs::create_dir(&inbox).map_err(|e| format!("couldn't create the Inbox folder: {e}"))?;
    } else if !inbox.is_dir() {
        return Err("Inbox in your vault is a file, not a folder".into());
    }
    let file = inbox.join(today_name(now));
    not_a_link(&file)?;
    let is_new = !file.exists();
    let mut handle = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file)
        .map_err(|e| format!("couldn't open today's Inbox note: {e}"))?;
    let mut body = String::new();
    if is_new {
        body.push_str(&format!("# Inbox {}\n\n", now.format("%Y-%m-%d")));
    }
    body.push_str(&format_entry(trimmed, now));
    handle
        .write_all(body.as_bytes())
        .map_err(|e| format!("couldn't write to today's Inbox note: {e}"))
}

/// Obsidian opens a vault, or a note in it, from an `obsidian://open?path=` link.
pub fn obsidian_url(vault: &str, today: Option<&DateTime<Local>>) -> Result<String, String> {
    let dir = vault_dir(vault)?;
    let target = match today {
        Some(now) => dir.join(INBOX).join(today_name(now)),
        None => dir,
    };
    Ok(format!(
        "obsidian://open?path={}",
        crate::services::weather::encode_component(&target.to_string_lossy())
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(h: u32, m: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(2026, 11, 23, h, m, 0).unwrap()
    }

    fn temp_vault(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("opendock-vault-{name}-{}", crate::store::now_ms()));
        fs::create_dir_all(dir.join(".obsidian")).unwrap();
        dir
    }

    #[test]
    fn formats_entries_as_list_items() {
        assert_eq!(
            format_entry("  Call Ama  ", &at(9, 5)),
            "- 09:05 Call Ama\n"
        );
        assert_eq!(
            format_entry("Idea\nmore detail\n\nlast", &at(14, 30)),
            "- 14:30 Idea\n  more detail\n\n  last\n"
        );
    }

    #[test]
    fn appends_to_todays_inbox_note() {
        let dir = temp_vault("append");
        let vault = dir.to_string_lossy().into_owned();
        capture(&vault, "First thought", &at(9, 0)).unwrap();
        capture(&vault, "Second\nwith detail", &at(9, 30)).unwrap();
        let text = fs::read_to_string(dir.join("Inbox/2026-11-23.md")).unwrap();
        assert_eq!(
            text,
            "# Inbox 2026-11-23\n\n- 09:00 First thought\n- 09:30 Second\n  with detail\n"
        );
        let status = status(&vault, &at(10, 0));
        assert!(status.exists && status.is_obsidian && status.configured);
        assert_eq!(status.today_file, "Inbox/2026-11-23.md");
        assert_eq!(status.today_count, 2);
        assert_eq!(status.recent, vec!["Second", "First thought"]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_bad_input_and_missing_vaults() {
        let dir = temp_vault("refuse");
        let vault = dir.to_string_lossy().into_owned();
        assert!(capture(&vault, "   ", &at(9, 0)).is_err());
        assert!(capture(&vault, &"x".repeat(MAX_CAPTURE_CHARS + 1), &at(9, 0)).is_err());
        assert!(capture("", "note", &at(9, 0)).is_err());
        assert!(capture("relative\\vault", "note", &at(9, 0)).is_err());
        let missing = dir.join("missing").to_string_lossy().into_owned();
        assert!(capture(&missing, "note", &at(9, 0)).is_err());
        assert!(!status(&missing, &at(9, 0)).exists);
        fs::write(dir.join("Inbox"), "not a folder").unwrap();
        assert!(capture(&vault, "note", &at(9, 0)).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn builds_obsidian_links() {
        let dir = temp_vault("link");
        let vault = dir.to_string_lossy().into_owned();
        let link = obsidian_url(&vault, None).unwrap();
        assert!(link.starts_with("obsidian://open?path="));
        assert!(!link.contains(' '));
        let today = obsidian_url(&vault, Some(&at(8, 0))).unwrap();
        assert!(today.ends_with("2026-11-23.md"));
        let _ = fs::remove_dir_all(&dir);
    }
}
