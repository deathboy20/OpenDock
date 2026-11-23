//! Commands for the developer widgets. Each one acts only on what the latest scan or the
//! settings already name, never on a path or URL the webview makes up.

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::platform::{self, process::FolderTool};
use crate::services::projects::{self, ProjectsSnapshot};
use crate::services::Wakers;
use crate::state::AppState;

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
