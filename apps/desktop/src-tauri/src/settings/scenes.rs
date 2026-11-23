//! Scenes: saved setups (Work, Focus, Present) that switch the dock's widgets, look, skin,
//! quiet hours and automations together. Mirrors `packages/config-schema/src/scenes.ts`.
//! A scene never touches the taskbar mode, so switching scenes can't hide the taskbar.

use serde::{Deserialize, Serialize};

use super::skins::is_valid_skin_id;
use super::types::{AppSettings, DockSpacing, DockStyle, Theme};
use crate::engine::rules::is_valid_id;
use crate::geometry::{DockPosition, DockSize};

pub const MAX_SCENES: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SceneDock {
    pub item_order: Vec<String>,
    pub size: DockSize,
    pub style: DockStyle,
    pub spacing: DockSpacing,
    pub position: DockPosition,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub dock: SceneDock,
    pub theme: Theme,
    #[serde(default)]
    pub skin: Option<String>,
    pub quiet_hours: bool,
    pub automations: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SceneSettings {
    pub items: Vec<Scene>,
    /// The scene applied last, if any. Changing settings afterwards doesn't clear it.
    pub active: Option<String>,
}

fn validate_order(order: &[String]) -> Result<(), String> {
    if order.is_empty() || order.len() > 32 {
        return Err("a scene needs 1-32 dock items".into());
    }
    for (index, id) in order.iter().enumerate() {
        if !is_valid_id(id) || order[..index].contains(id) {
            return Err(format!("invalid or repeated dock item in a scene: {id}"));
        }
    }
    Ok(())
}

impl SceneSettings {
    pub fn validate(&self) -> Result<(), String> {
        if self.items.len() > MAX_SCENES {
            return Err(format!("at most {MAX_SCENES} scenes"));
        }
        for (index, scene) in self.items.iter().enumerate() {
            if !is_valid_skin_id(&scene.id) {
                return Err(format!("invalid scene id: {}", scene.id));
            }
            if self.items[..index].iter().any(|s| s.id == scene.id) {
                return Err("two scenes share an id".into());
            }
            let name = scene.name.trim();
            if name.is_empty() || name.chars().count() > 40 {
                return Err("scene names must be 1-40 characters".into());
            }
            validate_order(&scene.dock.item_order)?;
            if scene.skin.as_deref().is_some_and(|s| !is_valid_skin_id(s)) {
                return Err("invalid skin in a scene".into());
            }
        }
        if let Some(active) = &self.active {
            if !self.items.iter().any(|s| &s.id == active) {
                return Err("the active scene doesn't exist".into());
            }
        }
        Ok(())
    }
}

/// A scene id from its name, unique among the existing scenes.
pub fn scene_id(name: &str, taken: &[String]) -> String {
    let mut base: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while base.contains("--") {
        base = base.replace("--", "-");
    }
    let base = base.trim_matches('-').chars().take(32).collect::<String>();
    let base = if base.is_empty() {
        "scene".to_string()
    } else {
        base
    };
    let mut id = base.clone();
    let mut n = 2;
    while taken.contains(&id) {
        id = format!("{base}-{n}");
        n += 1;
    }
    id
}

/// The current setup as a scene.
pub fn capture(settings: &AppSettings, id: String, name: &str) -> Scene {
    Scene {
        id,
        name: name.trim().to_string(),
        dock: SceneDock {
            item_order: settings.dock.item_order.clone(),
            size: settings.dock.size,
            style: settings.dock.style,
            spacing: settings.dock.spacing,
            position: settings.dock.position,
        },
        theme: settings.dock.theme,
        skin: settings.skins.active.clone(),
        quiet_hours: settings.automation.quiet_hours.enabled,
        automations: settings.automation.enabled,
    }
}

/// Settings with a scene applied. A skin that has since been deleted falls back to none.
pub fn apply(settings: &AppSettings, scene: &Scene) -> AppSettings {
    let mut next = settings.clone();
    next.dock.item_order = scene.dock.item_order.clone();
    next.dock.size = scene.dock.size;
    next.dock.style = scene.dock.style;
    next.dock.spacing = scene.dock.spacing;
    next.dock.position = scene.dock.position;
    next.dock.theme = scene.theme;
    let skin_exists = scene.skin.as_ref().is_some_and(|id| {
        super::skins::builtin_ids().contains(id)
            || settings.skins.custom.iter().any(|s| &s.id == id)
    });
    next.skins.active = if skin_exists {
        scene.skin.clone()
    } else {
        None
    };
    next.automation.quiet_hours.enabled = scene.quiet_hours;
    next.automation.enabled = scene.automations;
    next.scenes.active = Some(scene.id.clone());
    next
}

/// Saves the current setup under a name, replacing a scene of the same name.
pub fn save_current(settings: &AppSettings, name: &str) -> Result<(AppSettings, Scene), String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 40 {
        return Err("Give the scene a name of up to 40 characters".into());
    }
    let mut next = settings.clone();
    let existing = next
        .scenes
        .items
        .iter()
        .position(|s| s.name.eq_ignore_ascii_case(name));
    let scene = match existing {
        Some(index) => {
            let scene = capture(settings, next.scenes.items[index].id.clone(), name);
            next.scenes.items[index] = scene.clone();
            scene
        }
        None => {
            if next.scenes.items.len() >= MAX_SCENES {
                return Err(format!(
                    "You can keep up to {MAX_SCENES} scenes. Delete one first."
                ));
            }
            let taken: Vec<String> = next.scenes.items.iter().map(|s| s.id.clone()).collect();
            let scene = capture(settings, scene_id(name, &taken), name);
            next.scenes.items.push(scene.clone());
            scene
        }
    };
    next.scenes.active = Some(scene.id.clone());
    Ok((next, scene))
}

pub fn delete(settings: &AppSettings, id: &str) -> AppSettings {
    let mut next = settings.clone();
    next.scenes.items.retain(|s| s.id != id);
    if next.scenes.active.as_deref() == Some(id) {
        next.scenes.active = None;
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::types::TaskbarMode;

    #[test]
    fn saves_and_applies_a_scene_without_touching_the_taskbar() {
        let mut settings = AppSettings::default();
        settings.taskbar.mode = TaskbarMode::Normal;
        settings.dock.item_order = vec!["clock".into(), "projects".into()];
        settings.dock.style = DockStyle::Ink;
        settings.skins.active = Some("dusk".into());
        let (saved, work) = save_current(&settings, " Work ").unwrap();
        assert_eq!(work.id, "work");
        assert_eq!(work.name, "Work");
        assert_eq!(saved.scenes.active.as_deref(), Some("work"));
        saved.validate().unwrap();

        let mut changed = saved.clone();
        changed.dock.item_order = vec!["clock".into()];
        changed.dock.style = DockStyle::Glass;
        changed.skins.active = None;
        changed.taskbar.mode = TaskbarMode::Autohide;
        let back = apply(&changed, &work);
        assert_eq!(back.dock.item_order, vec!["clock", "projects"]);
        assert_eq!(back.dock.style, DockStyle::Ink);
        assert_eq!(back.skins.active.as_deref(), Some("dusk"));
        assert_eq!(back.taskbar.mode, TaskbarMode::Autohide);
        back.validate().unwrap();
    }

    #[test]
    fn replaces_by_name_and_drops_missing_skins() {
        let settings = AppSettings::default();
        let (one, _) = save_current(&settings, "Focus").unwrap();
        let (two, again) = save_current(&one, "focus").unwrap();
        assert_eq!(two.scenes.items.len(), 1);
        assert_eq!(again.id, "focus");
        let mut ghost = again.clone();
        ghost.skin = Some("deleted-skin".into());
        assert_eq!(apply(&two, &ghost).skins.active, None);
        assert!(save_current(&settings, "  ").is_err());
    }

    #[test]
    fn deletes_and_validates() {
        let (saved, scene) = save_current(&AppSettings::default(), "Present").unwrap();
        let gone = delete(&saved, &scene.id);
        assert!(gone.scenes.items.is_empty());
        assert_eq!(gone.scenes.active, None);
        let mut broken = saved.clone();
        broken.scenes.active = Some("nope".into());
        assert!(broken.validate().is_err());
        assert_eq!(scene_id("Late night!", &[]), "late-night");
        assert_eq!(scene_id("Work", &["work".into()]), "work-2");
        assert_eq!(scene_id("***", &[]), "scene");
    }
}
