//! Starting helper programs: `git` for the Projects widget, and editors or a terminal for a
//! project folder. Arguments are passed straight to the program, never through a shell.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

/// Where the Projects widget can open a folder. GitHub Desktop and Explorer go through
/// `launch_path` instead, because they are opened by URL or by the shell.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FolderTool {
    Cursor,
    Vscode,
    Terminal,
}

/// A command that doesn't flash a console window when OpenDock (a GUI app) starts it.
pub fn background_command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

#[cfg(windows)]
fn env_path(var: &str, tail: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(|base| PathBuf::from(base).join(tail))
}

#[cfg(windows)]
fn first_existing(candidates: Vec<Option<PathBuf>>) -> Option<PathBuf> {
    candidates.into_iter().flatten().find(|p| p.is_file())
}

/// The installed program for a tool. Per-user installs come first, as their installers default to.
#[cfg(windows)]
fn tool_program(tool: FolderTool) -> Option<PathBuf> {
    match tool {
        FolderTool::Cursor => first_existing(vec![
            env_path("LOCALAPPDATA", r"Programs\cursor\Cursor.exe"),
            env_path("ProgramFiles", r"Cursor\Cursor.exe"),
        ]),
        FolderTool::Vscode => first_existing(vec![
            env_path("LOCALAPPDATA", r"Programs\Microsoft VS Code\Code.exe"),
            env_path("ProgramFiles", r"Microsoft VS Code\Code.exe"),
        ]),
        FolderTool::Terminal => first_existing(vec![
            env_path("LOCALAPPDATA", r"Microsoft\WindowsApps\wt.exe"),
            env_path(
                "SystemRoot",
                r"System32\WindowsPowerShell\v1.0\powershell.exe",
            ),
        ]),
    }
}

#[cfg(not(windows))]
fn tool_program(tool: FolderTool) -> Option<PathBuf> {
    match tool {
        FolderTool::Cursor => Some(PathBuf::from("cursor")),
        FolderTool::Vscode => Some(PathBuf::from("code")),
        FolderTool::Terminal => None,
    }
}

pub fn tool_name(tool: FolderTool) -> &'static str {
    match tool {
        FolderTool::Cursor => "Cursor",
        FolderTool::Vscode => "VS Code",
        FolderTool::Terminal => "a terminal",
    }
}

pub fn open_folder_with(tool: FolderTool, folder: &Path) -> Result<(), String> {
    let program =
        tool_program(tool).ok_or_else(|| format!("{} isn't installed", tool_name(tool)))?;
    let mut command = Command::new(&program);
    let is_windows_terminal = program
        .file_name()
        .is_some_and(|name| name.eq_ignore_ascii_case("wt.exe"));
    match tool {
        FolderTool::Terminal if is_windows_terminal => {
            command.arg("-d").arg(folder);
        }
        FolderTool::Terminal => {
            command.arg("-NoExit").current_dir(folder);
        }
        FolderTool::Cursor | FolderTool::Vscode => {
            command.arg(folder);
        }
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("couldn't start {}: {e}", tool_name(tool)))
}
