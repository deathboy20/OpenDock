//! Commands for the developer widgets. Each one acts only on what the latest scan or the
//! settings already name, never on a path or URL the webview makes up.

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::platform::{self, process::FolderTool};
use crate::services::ci::{self, CiSnapshot};
use crate::services::local_ai::{self, LocalAiSnapshot};
use crate::services::projects::{self, ProjectsSnapshot};
use crate::services::vault::{self, VaultStatus};
use crate::services::Wakers;
use crate::state::{notify_changed, AppState};

const MAX_PATH_CHARS: usize = 1024;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectTool {
    Cursor,
    Vscode,
    Terminal,
    GithubDesktop,
    Explorer,
}

fn known_project_path(state: &AppState, path: &str) -> Result<String, String> {
    if path.chars().count() > MAX_PATH_CHARS {
        return Err("that path is too long".into());
    }
    let snapshot = state.live.projects.lock().ok().and_then(|p| p.clone());
    snapshot
        .as_ref()
        .and_then(|s| projects::known_project(s, path))
        .map(|p| p.path.clone())
        .ok_or_else(|| "OpenDock only opens projects inside your project folders".into())
}

// ---------- projects ----------

#[tauri::command]
pub fn get_projects(state: State<'_, AppState>) -> Option<ProjectsSnapshot> {
    state.live.projects.lock().ok().and_then(|p| p.clone())
}

#[tauri::command]
pub fn refresh_projects(app: AppHandle) {
    app.state::<Wakers>().wake_projects();
}

#[tauri::command]
pub async fn open_project(app: AppHandle, path: String, tool: ProjectTool) -> Result<(), String> {
    let path = known_project_path(&app.state::<AppState>(), &path)?;
    tauri::async_runtime::spawn_blocking(move || match tool {
        ProjectTool::Cursor => {
            platform::process::open_folder_with(FolderTool::Cursor, path.as_ref())
        }
        ProjectTool::Vscode => {
            platform::process::open_folder_with(FolderTool::Vscode, path.as_ref())
        }
        ProjectTool::Terminal => {
            platform::process::open_folder_with(FolderTool::Terminal, path.as_ref())
        }
        ProjectTool::GithubDesktop => platform::launch_path(&projects::github_desktop_url(&path))
            .map_err(|_| "GitHub Desktop isn't installed".to_string()),
        ProjectTool::Explorer => platform::launch_path(&path),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn read_handoff(state: State<'_, AppState>, path: String) -> Result<Option<String>, String> {
    let path = known_project_path(&state, &path)?;
    let snapshot = state.live.projects.lock().ok().and_then(|p| p.clone());
    let project = snapshot
        .as_ref()
        .and_then(|s| projects::known_project(s, &path))
        .ok_or_else(|| "that project is no longer listed".to_string())?;
    projects::read_handoff(project)
}

// ---------- vault capture ----------

#[tauri::command]
pub fn get_vault_status(state: State<'_, AppState>) -> VaultStatus {
    vault::status(&state.settings().widgets.vault.path, &chrono::Local::now())
}

#[tauri::command]
pub fn vault_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    text: String,
) -> Result<(), String> {
    if text.chars().count() > vault::MAX_CAPTURE_CHARS * 2 {
        return Err("that note is too long".into());
    }
    vault::capture(
        &state.settings().widgets.vault.path,
        &text,
        &chrono::Local::now(),
    )?;
    notify_changed(&app, "vault");
    Ok(())
}

/// Opens the vault, or today's Inbox note, in Obsidian.
#[tauri::command]
pub async fn open_vault(app: AppHandle, today: bool) -> Result<(), String> {
    let path = app.state::<AppState>().settings().widgets.vault.path;
    let now = chrono::Local::now();
    let url = vault::obsidian_url(&path, today.then_some(&now))?;
    tauri::async_runtime::spawn_blocking(move || {
        platform::launch_path(&url).map_err(|_| "Obsidian isn't installed".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------- local AI ----------

#[tauri::command]
pub fn get_local_ai(state: State<'_, AppState>) -> Option<LocalAiSnapshot> {
    state.live.local_ai.lock().ok().and_then(|s| s.clone())
}

#[tauri::command]
pub fn refresh_local_ai(app: AppHandle) {
    app.state::<Wakers>().wake_local_ai();
}

/// Sends one prompt to a model Ollama listed in the latest check.
#[tauri::command]
pub async fn ask_local_ai(app: AppHandle, model: String, prompt: String) -> Result<String, String> {
    if prompt.chars().count() > local_ai::MAX_PROMPT_CHARS * 2 || model.len() > 128 {
        return Err("that prompt is too long".into());
    }
    let known = app
        .state::<AppState>()
        .live
        .local_ai
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .is_some_and(|s| s.models.iter().any(|m| m.name == model));
    if !known {
        return Err(format!("{model} isn't one of your Ollama models"));
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let answer = local_ai::ask(&state.db, &model, &prompt);
        // A prompt loads the model; show that straight away.
        app.state::<Wakers>().wake_local_ai();
        answer
    })
    .await
    .map_err(|e| e.to_string())?;
    result
}

// ---------- CI status ----------

#[tauri::command]
pub fn get_ci_status(state: State<'_, AppState>) -> Option<CiSnapshot> {
    state.live.ci.lock().ok().and_then(|s| s.clone())
}

#[tauri::command]
pub fn refresh_ci(app: AppHandle) {
    app.state::<Wakers>().wake_ci();
}

/// Opens the latest run's page for a repository in the latest check.
#[tauri::command]
pub async fn open_ci_run(app: AppHandle, repo: String) -> Result<(), String> {
    let url = app
        .state::<AppState>()
        .live
        .ci
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .and_then(|s| s.repos.into_iter().find(|r| r.repo == repo))
        .and_then(|r| r.run)
        .map(|run| run.url)
        .filter(|url| url.starts_with("https://github.com/"))
        .ok_or_else(|| "There is no run to open for that repository".to_string())?;
    tauri::async_runtime::spawn_blocking(move || platform::launch_path(&url))
        .await
        .map_err(|e| e.to_string())?
}

/// Stores the GitHub token in the OS keychain. It is never sent back to the webview.
#[tauri::command]
pub async fn set_github_token(app: AppHandle, token: String) -> Result<(), String> {
    if token.len() > 512 {
        return Err("That doesn't look like a GitHub token".into());
    }
    tauri::async_runtime::spawn_blocking(move || ci::set_token(&token))
        .await
        .map_err(|e| e.to_string())??;
    app.state::<Wakers>().wake_ci();
    Ok(())
}

#[tauri::command]
pub async fn clear_github_token(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(ci::clear_token)
        .await
        .map_err(|e| e.to_string())??;
    app.state::<Wakers>().wake_ci();
    Ok(())
}
