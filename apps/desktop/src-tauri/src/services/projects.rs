//! The Projects widget: git repositories under the folders the user chose, with branch,
//! uncommitted changes and how far each is ahead of or behind its upstream.
//!
//! Git is read with the `git` command line, one `git status` per repository. Every action
//! takes a path from the latest scan, so nothing outside the chosen folders is opened or read.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::platform::process::background_command;
use crate::store::now_ms;

pub const MAX_PROJECTS: usize = 80;
const MAX_HANDOFF_BYTES: u64 = 512 * 1024;
const GIT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
const SKIPPED_DIRS: [&str; 4] = ["node_modules", "target", "dist", "build"];

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: Option<String>,
    pub detached: bool,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    /// Changed, staged, conflicted and untracked files.
    pub dirty: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub name: String,
    pub path: String,
    pub root: String,
    #[serde(flatten)]
    pub status: GitStatus,
    pub has_handoff: bool,
    /// Set when `git status` failed for this repository.
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectsSnapshot {
    pub projects: Vec<Project>,
    /// Configured folders that don't exist or aren't folders.
    pub missing_roots: Vec<String>,
    /// More repositories were found than the widget lists.
    pub truncated: bool,
    /// False when the `git` command couldn't be started at all.
    pub git_available: bool,
    pub scanned_at: i64,
}

/// Parses `git status --porcelain=v2 --branch`.
pub fn parse_status(text: &str) -> GitStatus {
    let mut status = GitStatus::default();
    for line in text.lines() {
        if let Some(head) = line.strip_prefix("# branch.head ") {
            if head == "(detached)" {
                status.detached = true;
            } else {
                status.branch = Some(head.to_string());
            }
        } else if let Some(upstream) = line.strip_prefix("# branch.upstream ") {
            status.upstream = Some(upstream.to_string());
        } else if let Some(ab) = line.strip_prefix("# branch.ab ") {
            let mut parts = ab.split_whitespace();
            status.ahead = parts
                .next()
                .and_then(|a| a.strip_prefix('+'))
                .and_then(|a| a.parse().ok());
            status.behind = parts
                .next()
                .and_then(|b| b.strip_prefix('-'))
                .and_then(|b| b.parse().ok());
        } else if line.starts_with("1 ")
            || line.starts_with("2 ")
            || line.starts_with("u ")
            || line.starts_with("? ")
        {
            status.dirty = status.dirty.saturating_add(1);
        }
    }
    status
}

fn is_repo(dir: &Path) -> bool {
    // `.git` is a folder in a normal clone and a file in a worktree or submodule.
    fs::symlink_metadata(dir.join(".git")).is_ok()
}

fn child_dirs(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return vec![];
    };
    let mut dirs: Vec<PathBuf> = entries
        .flatten()
        .filter(|entry| {
            // Symlinks and junctions are skipped so a scan can't wander out of the root.
            entry.file_type().is_ok_and(|t| t.is_dir())
                && entry.file_name().to_str().is_some_and(|name| {
                    !name.starts_with('.')
                        && !name.starts_with('$')
                        && !SKIPPED_DIRS.contains(&name)
                })
        })
        .map(|entry| entry.path())
        .collect();
    dirs.sort_by_key(|p| p.to_string_lossy().to_lowercase());
    dirs
}

/// Repositories at the root itself, or one or two folders below it.
pub fn find_repos(root: &Path, limit: usize) -> Vec<PathBuf> {
    if is_repo(root) {
        return vec![root.to_path_buf()];
    }
    let mut found = Vec::new();
    for child in child_dirs(root) {
        if found.len() >= limit {
            break;
        }
        if is_repo(&child) {
            found.push(child);
            continue;
        }
        for grandchild in child_dirs(&child) {
            if found.len() >= limit {
                break;
            }
            if is_repo(&grandchild) {
                found.push(grandchild);
            }
        }
    }
    found
}

enum GitError {
    NotInstalled,
    Failed(String),
}

fn git_status(repo: &Path) -> Result<GitStatus, GitError> {
    let mut command = background_command("git");
    command
        .arg("-C")
        .arg(repo)
        // A repository's own config must not run programs while OpenDock only reads it.
        .args(["-c", "core.fsmonitor=false", "--no-optional-locks"])
        .args(["status", "--porcelain=v2", "--branch"]);
    // A slow network drive or a huge repository must not stall the whole scan; the git
    // process finishes in the background and its result is dropped.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(command.output());
    });
    let output = rx
        .recv_timeout(GIT_TIMEOUT)
        .map_err(|_| GitError::Failed("git status took too long".into()))?
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => GitError::NotInstalled,
            _ => GitError::Failed(e.to_string()),
        })?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr);
        let first = message.lines().next().unwrap_or("git status failed").trim();
        return Err(GitError::Failed(first.chars().take(200).collect()));
    }
    Ok(parse_status(&String::from_utf8_lossy(&output.stdout)))
}

fn has_handoff(repo: &Path) -> bool {
    fs::symlink_metadata(repo.join("HANDOFF.md")).is_ok_and(|m| m.is_file())
}

pub fn scan(roots: &[String]) -> ProjectsSnapshot {
    let mut snapshot = ProjectsSnapshot {
        git_available: true,
        scanned_at: now_ms(),
        ..Default::default()
    };
    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.is_dir() {
            snapshot.missing_roots.push(root.clone());
            continue;
        }
        let room = MAX_PROJECTS.saturating_sub(snapshot.projects.len());
        let repos = find_repos(&root_path, room + 1);
        if repos.len() > room {
            snapshot.truncated = true;
        }
        for repo in repos.into_iter().take(room) {
            let name = repo
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| repo.to_string_lossy().into_owned());
            let (status, error) = if snapshot.git_available {
                match git_status(&repo) {
                    Ok(status) => (status, None),
                    Err(GitError::NotInstalled) => {
                        snapshot.git_available = false;
                        (
                            GitStatus::default(),
                            Some("git isn't installed".to_string()),
                        )
                    }
                    Err(GitError::Failed(message)) => (GitStatus::default(), Some(message)),
                }
            } else {
                (
                    GitStatus::default(),
                    Some("git isn't installed".to_string()),
                )
            };
            snapshot.projects.push(Project {
                name,
                has_handoff: has_handoff(&repo),
                path: repo.to_string_lossy().into_owned(),
                root: root.clone(),
                status,
                error,
            });
        }
    }
    snapshot
}

/// The project at exactly this path in the latest scan.
pub fn known_project<'a>(snapshot: &'a ProjectsSnapshot, path: &str) -> Option<&'a Project> {
    snapshot.projects.iter().find(|p| p.path == path)
}

pub fn read_handoff(project: &Project) -> Result<Option<String>, String> {
    let file = Path::new(&project.path).join("HANDOFF.md");
    let Ok(meta) = fs::symlink_metadata(&file) else {
        return Ok(None);
    };
    if !meta.is_file() {
        return Ok(None);
    }
    let mut text = String::new();
    fs::File::open(&file)
        .and_then(|f| f.take(MAX_HANDOFF_BYTES).read_to_string(&mut text))
        .map_err(|e| format!("couldn't read HANDOFF.md: {e}"))?;
    Ok(Some(text))
}

/// GitHub Desktop opens a local repository from this link.
pub fn github_desktop_url(path: &str) -> String {
    format!(
        "x-github-client://openLocalRepo/{}",
        crate::services::weather::encode_component(path)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_branch_upstream_and_changes() {
        let status = parse_status(
            "# branch.oid 1fe5078\n# branch.head feat/developer-widgets\n\
             # branch.upstream origin/feat/developer-widgets\n# branch.ab +2 -1\n\
             1 .M N... 100644 100644 100644 a b src/lib.rs\n\
             2 R. N... 100644 100644 100644 a b R100 new.rs\told.rs\n\
             u UU N... 1 2 3 4 a b c conflict.rs\n? notes.txt\n! ignored.log\n",
        );
        assert_eq!(status.branch.as_deref(), Some("feat/developer-widgets"));
        assert_eq!(
            status.upstream.as_deref(),
            Some("origin/feat/developer-widgets")
        );
        assert_eq!((status.ahead, status.behind), (Some(2), Some(1)));
        assert_eq!(status.dirty, 4);
        assert!(!status.detached);
    }

    #[test]
    fn parses_detached_heads_without_upstream() {
        let status = parse_status("# branch.oid abc\n# branch.head (detached)\n");
        assert!(status.detached);
        assert_eq!(status.branch, None);
        assert_eq!((status.ahead, status.behind), (None, None));
        assert_eq!(status.dirty, 0);
    }

    #[test]
    fn finds_repos_two_levels_deep_and_skips_noise() {
        let root = std::env::temp_dir().join(format!("opendock-projects-{}", now_ms()));
        for dir in [
            "alpha/.git",
            "group/beta/.git",
            "group/gamma/.git",
            "node_modules/pkg/.git",
            ".hidden/delta/.git",
            "plain/folder",
            "deep/one/two/.git",
        ] {
            fs::create_dir_all(root.join(dir)).unwrap();
        }
        fs::write(root.join("group/gamma/HANDOFF.md"), "# Handoff\n").unwrap();
        let names: Vec<String> = find_repos(&root, 10)
            .iter()
            .map(|p| {
                p.strip_prefix(&root)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/")
            })
            .collect();
        assert_eq!(names, vec!["alpha", "group/beta", "group/gamma"]);
        assert_eq!(find_repos(&root, 2).len(), 2);
        assert!(has_handoff(&root.join("group/gamma")));
        assert!(!has_handoff(&root.join("alpha")));

        let snapshot = scan(&[
            root.to_string_lossy().into_owned(),
            root.join("missing").to_string_lossy().into_owned(),
        ]);
        assert_eq!(snapshot.projects.len(), 3);
        assert_eq!(snapshot.missing_roots.len(), 1);
        let gamma = known_project(&snapshot, &snapshot.projects[2].path).unwrap();
        assert_eq!(read_handoff(gamma).unwrap().as_deref(), Some("# Handoff\n"));
        assert!(known_project(&snapshot, &root.to_string_lossy()).is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn builds_github_desktop_links() {
        assert_eq!(
            github_desktop_url(r"D:\Gitfiles\Open Dock"),
            "x-github-client://openLocalRepo/D%3A%5CGitfiles%5COpen%20Dock"
        );
    }
}
