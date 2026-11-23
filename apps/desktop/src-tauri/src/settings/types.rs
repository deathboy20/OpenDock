use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::desktop::DesktopSettings;
use super::scenes::SceneSettings;
use super::skins::SkinSettings;
use crate::engine::rules::{is_valid_id, parse_clock};
use crate::geometry::{DockDensity, DockMode, DockPosition, DockSize};

pub const SETTINGS_VERSION: u32 = 7;
pub const MAX_PINNED_APPS: usize = 24;
pub const MAX_PROJECT_ROOTS: usize = 8;
pub const MAX_CI_REPOS: usize = 10;
pub const MAX_WIDGET_OPTIONS: usize = 40;

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DockStyle {
    #[default]
    Glass,
    Solid,
    Midnight,
    /// No bar behind the items; they float on the wallpaper.
    Minimal,
    Neon,
    /// Opaque and high contrast.
    Ink,
}

/// One bar, separate capsules for runs of related widgets, or a capsule per widget.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DockLayout {
    #[default]
    Bar,
    Islands,
    Chips,
}

/// How opaque the dock's surface is; stronger reads better on bright or busy wallpapers.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DockTint {
    #[default]
    Soft,
    Medium,
    Strong,
}

/// Gap between dock items. Independent of icon size.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DockSpacing {
    Tight,
    #[default]
    Even,
    Roomy,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskbarMode {
    #[default]
    Normal,
    Autohide,
    Hidden,
    /// Hidden, and the dock reserves the screen edge the way the taskbar did.
    Replace,
}

impl TaskbarMode {
    pub fn hides_taskbar(self) -> bool {
        matches!(self, TaskbarMode::Hidden | TaskbarMode::Replace)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum StartAction {
    /// OpenDock's own launcher with search, pinned apps and power options.
    #[default]
    Launcher,
    Windows,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TemperatureUnit {
    #[default]
    C,
    F,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DockSettings {
    pub position: DockPosition,
    pub size: DockSize,
    pub mode: DockMode,
    pub theme: Theme,
    #[serde(default)]
    pub style: DockStyle,
    #[serde(default)]
    pub spacing: DockSpacing,
    #[serde(default)]
    pub layout: DockLayout,
    #[serde(default)]
    pub density: DockDensity,
    #[serde(default)]
    pub tint: DockTint,
    #[serde(default)]
    pub monitor_id: Option<String>,
    pub item_order: Vec<String>,
    pub clock24h: bool,
    pub launch_at_startup: bool,
    #[serde(default = "default_true")]
    pub auto_hide_in_fullscreen: bool,
    #[serde(default)]
    pub start_action: StartAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PinnedApp {
    pub name: String,
    /// What gets launched: a shortcut, an executable or a URI.
    pub path: String,
    /// The executable behind a shortcut, so running windows group under the pin.
    #[serde(default)]
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppsSettings {
    pub pinned: Vec<PinnedApp>,
    /// One icon per app with a window count, instead of one per window.
    pub group_windows: bool,
    /// Show the active window's title next to its icon.
    pub show_titles: bool,
}

impl Default for AppsSettings {
    fn default() -> Self {
        Self {
            pinned: Vec::new(),
            group_windows: true,
            show_titles: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarSettings {
    #[serde(default)]
    pub mode: TaskbarMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeatherSettings {
    #[serde(default)]
    pub city: String,
    #[serde(default)]
    pub latitude: Option<f64>,
    #[serde(default)]
    pub longitude: Option<f64>,
    #[serde(default)]
    pub unit: TemperatureUnit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct FocusSettings {
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

impl Default for FocusSettings {
    fn default() -> Self {
        Self {
            focus_minutes: 25,
            break_minutes: 5,
        }
    }
}

/// How a widget fills its dock slot: follow the dock size, icon only, or the large layout.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum WidgetLayout {
    #[default]
    Auto,
    Compact,
    Detailed,
}

/// Accent swatches from tokens.css. `Theme` keeps the dock's accent.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum WidgetAccent {
    #[default]
    Theme,
    Mint,
    Sky,
    Amber,
    Rose,
    Violet,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct WidgetOptions {
    /// Shown as the widget's name in tooltips and panel titles. Empty uses the widget's name.
    pub label: String,
    pub layout: WidgetLayout,
    pub accent: WidgetAccent,
    /// Seconds between checks for widgets that poll. `None` uses the widget's default.
    pub refresh_seconds: Option<u32>,
    /// How the widget draws its data (see widget-variants.json). `None` uses its default.
    pub variant: Option<String>,
}

/// Asks GitHub once a day whether a newer release exists. Nothing else is sent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateSettings {
    pub check: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self { check: true }
    }
}

/// Folders whose git repositories the Projects widget lists, one or two levels deep.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ProjectsSettings {
    pub roots: Vec<String>,
}

/// The Obsidian vault the capture box writes to. Empty until the user picks one.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct VaultSettings {
    pub path: String,
}

/// The Ollama model quick prompts go to. Empty means the first installed model.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalAiSettings {
    pub model: String,
}

/// Off by default: CI status is the only developer widget that leaves the device.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CiSettings {
    pub enabled: bool,
    pub repos: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSettings {
    /// Options per dock widget, keyed by widget id.
    #[serde(default)]
    pub options: BTreeMap<String, WidgetOptions>,
    #[serde(default)]
    pub weather: WeatherSettings,
    #[serde(default)]
    pub focus: FocusSettings,
    #[serde(default)]
    pub projects: ProjectsSettings,
    #[serde(default)]
    pub vault: VaultSettings,
    #[serde(default)]
    pub local_ai: LocalAiSettings,
    #[serde(default)]
    pub ci: CiSettings,
}

/// `owner/name`, as GitHub allows them. Mirrors `githubRepoSchema`.
pub fn is_valid_github_repo(repo: &str) -> bool {
    let Some((owner, name)) = repo.split_once('/') else {
        return false;
    };
    let owner_ok = (1..=39).contains(&owner.len())
        && owner.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        && !owner.starts_with('-');
    let name_ok = (1..=100).contains(&name.len())
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        && name != "."
        && name != "..";
    owner_ok && name_ok
}

fn has_duplicates_ignoring_case(values: &[String]) -> bool {
    values.iter().enumerate().any(|(index, value)| {
        let key = value.to_lowercase();
        values[..index].iter().any(|v| v.to_lowercase() == key)
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct QuietHours {
    pub enabled: bool,
    pub start: String,
    pub end: String,
}

impl Default for QuietHours {
    fn default() -> Self {
        Self {
            enabled: false,
            start: "22:00".into(),
            end: "07:00".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub quiet_hours: QuietHours,
}

impl Default for AutomationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            quiet_hours: QuietHours::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub version: u32,
    pub dock: DockSettings,
    #[serde(default)]
    pub taskbar: TaskbarSettings,
    #[serde(default)]
    pub widgets: WidgetSettings,
    #[serde(default)]
    pub automation: AutomationSettings,
    #[serde(default)]
    pub apps: AppsSettings,
    #[serde(default)]
    pub skins: SkinSettings,
    #[serde(default)]
    pub scenes: SceneSettings,
    #[serde(default)]
    pub desktop: DesktopSettings,
    #[serde(default)]
    pub updates: UpdateSettings,
    /// False until the first-run welcome has been completed or skipped.
    #[serde(default)]
    pub onboarded: bool,
}

pub const DEFAULT_ITEM_ORDER: [&str; 7] = [
    "start",
    "apps",
    "media",
    "clock",
    "volume",
    "tray",
    "add-widget",
];

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            dock: DockSettings {
                position: DockPosition::Bottom,
                size: DockSize::M,
                mode: DockMode::Pill,
                theme: Theme::Dark,
                style: DockStyle::Glass,
                spacing: DockSpacing::Even,
                layout: DockLayout::Bar,
                density: DockDensity::Regular,
                tint: DockTint::Soft,
                monitor_id: None,
                item_order: DEFAULT_ITEM_ORDER.iter().map(|s| s.to_string()).collect(),
                clock24h: false,
                launch_at_startup: false,
                auto_hide_in_fullscreen: true,
                start_action: StartAction::Launcher,
            },
            taskbar: TaskbarSettings::default(),
            widgets: WidgetSettings::default(),
            automation: AutomationSettings::default(),
            apps: AppsSettings::default(),
            skins: SkinSettings::default(),
            scenes: SceneSettings::default(),
            desktop: DesktopSettings::default(),
            updates: UpdateSettings::default(),
            onboarded: false,
        }
    }
}

impl AppSettings {
    /// Upgrades an older settings document in place. Returns true if anything changed.
    pub fn migrate(value: &mut serde_json::Value) -> bool {
        let version = value.get("version").and_then(|v| v.as_u64());
        // Version 4 added dock styles, version 5 spacing (even), version 6 the developer
        // widgets (projects, vault, local AI and CI, all empty or off), version 7 per-widget
        // options, skins, scenes and desktop widgets (all empty). Each defaults on load.
        if matches!(version, Some(3) | Some(4) | Some(5) | Some(6)) {
            value["version"] = serde_json::json!(SETTINGS_VERSION);
            return true;
        }
        if !matches!(version, Some(1) | Some(2)) {
            return false;
        }
        value["version"] = serde_json::json!(SETTINGS_VERSION);
        // People upgrading already set the dock up; don't greet them as new.
        value["onboarded"] = serde_json::json!(true);
        if let Some(order) = value
            .pointer_mut("/dock/itemOrder")
            .and_then(|o| o.as_array_mut())
        {
            if order.len() < 32 && !order.iter().any(|id| id == "apps") {
                let at = order
                    .iter()
                    .position(|id| id == "start")
                    .map_or(0, |i| i + 1);
                order.insert(at, serde_json::json!("apps"));
            }
        }
        true
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.version != SETTINGS_VERSION {
            return Err(format!("unsupported settings version {}", self.version));
        }
        let order = &self.dock.item_order;
        if order.is_empty() || order.len() > 32 {
            return Err("itemOrder must contain 1-32 entries".into());
        }
        for (index, id) in order.iter().enumerate() {
            if !is_valid_id(id) {
                return Err(format!("invalid dock item id: {id}"));
            }
            if order[..index].contains(id) {
                return Err(format!("duplicate dock item id: {id}"));
            }
        }
        if self.dock.monitor_id.as_ref().is_some_and(|m| m.len() > 256) {
            return Err("monitorId is too long".into());
        }
        let weather = &self.widgets.weather;
        if weather.city.chars().count() > 120 {
            return Err("weather city is too long".into());
        }
        if weather
            .latitude
            .is_some_and(|v| !(-90.0..=90.0).contains(&v))
        {
            return Err("latitude out of range".into());
        }
        if weather
            .longitude
            .is_some_and(|v| !(-180.0..=180.0).contains(&v))
        {
            return Err("longitude out of range".into());
        }
        let focus = &self.widgets.focus;
        if !(1..=180).contains(&focus.focus_minutes) || !(1..=60).contains(&focus.break_minutes) {
            return Err("focus lengths out of range".into());
        }
        let options = &self.widgets.options;
        if options.len() > MAX_WIDGET_OPTIONS {
            return Err("too many widget options".into());
        }
        for (id, option) in options {
            if !is_valid_id(id) {
                return Err(format!("invalid widget id in options: {id}"));
            }
            if option.label.chars().count() > 40 {
                return Err("widget labels must be at most 40 characters".into());
            }
            if option
                .refresh_seconds
                .is_some_and(|s| !(15..=3600).contains(&s))
            {
                return Err("refresh must be 15-3600 seconds".into());
            }
            if let Some(variant) = &option.variant {
                if !super::variants::is_valid_variant(id, variant) {
                    return Err(format!("{id} has no {variant} variant"));
                }
            }
        }
        let roots = &self.widgets.projects.roots;
        if roots.len() > MAX_PROJECT_ROOTS {
            return Err(format!("at most {MAX_PROJECT_ROOTS} project folders"));
        }
        if roots
            .iter()
            .any(|r| r.trim().is_empty() || r.chars().count() > 1024)
        {
            return Err("project folders must be 1-1024 characters".into());
        }
        if has_duplicates_ignoring_case(roots) {
            return Err("a project folder is listed twice".into());
        }
        let vault = &self.widgets.vault.path;
        if vault.chars().count() > 1024 {
            return Err("the vault path must be at most 1024 characters".into());
        }
        let model = &self.widgets.local_ai.model;
        if model.chars().count() > 128 {
            return Err("the local AI model name must be at most 128 characters".into());
        }
        let repos = &self.widgets.ci.repos;
        if repos.len() > MAX_CI_REPOS {
            return Err(format!("at most {MAX_CI_REPOS} CI repositories"));
        }
        if let Some(repo) = repos.iter().find(|r| !is_valid_github_repo(r)) {
            return Err(format!("{repo} is not an owner/name repository"));
        }
        if has_duplicates_ignoring_case(repos) {
            return Err("a CI repository is listed twice".into());
        }
        self.skins.validate()?;
        self.scenes.validate()?;
        self.desktop.validate()?;
        let quiet = &self.automation.quiet_hours;
        if parse_clock(&quiet.start).is_none() || parse_clock(&quiet.end).is_none() {
            return Err("quiet hours need HH:MM times".into());
        }
        let pinned = &self.apps.pinned;
        if pinned.len() > MAX_PINNED_APPS {
            return Err(format!("at most {MAX_PINNED_APPS} pinned apps"));
        }
        for (index, app) in pinned.iter().enumerate() {
            if app.name.trim().is_empty() || app.name.chars().count() > 120 {
                return Err("pinned app names must be 1-120 characters".into());
            }
            if app.path.is_empty() || app.path.chars().count() > 1024 {
                return Err("pinned app paths must be 1-1024 characters".into());
            }
            if app
                .target
                .as_ref()
                .is_some_and(|t| t.chars().count() > 1024)
            {
                return Err("pinned app target is too long".into());
            }
            let key = app.path.to_lowercase();
            if pinned[..index].iter().any(|p| p.path.to_lowercase() == key) {
                return Err(format!("{} is pinned twice", app.name));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[derive(Deserialize)]
    struct Fixture {
        valid: Vec<Value>,
        invalid: Vec<Value>,
    }

    fn parse(value: &Value) -> Result<AppSettings, String> {
        let settings: AppSettings =
            serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        settings.validate()?;
        Ok(settings)
    }

    #[test]
    fn parity_with_zod_settings_fixtures() {
        let fixture: Fixture = serde_json::from_str(include_str!(
            "../../../../../packages/config-schema/fixtures/settings.json"
        ))
        .unwrap();
        for value in &fixture.valid {
            parse(value).unwrap_or_else(|e| panic!("{value}: {e}"));
        }
        for value in &fixture.invalid {
            assert!(parse(value).is_err(), "expected invalid: {value}");
        }
    }

    #[test]
    fn defaults_are_valid() {
        AppSettings::default().validate().unwrap();
    }

    #[test]
    fn migrates_version_one() {
        let mut value = serde_json::json!({
            "version": 1,
            "dock": {
                "position": "top", "size": "s", "mode": "full", "theme": "light",
                "monitorId": null, "itemOrder": ["clock", "add-widget"],
                "clock24h": true, "launchAtStartup": false
            }
        });
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(settings.dock.style, DockStyle::Glass);
        assert_eq!(settings.taskbar.mode, TaskbarMode::Normal);
        assert!(settings.dock.auto_hide_in_fullscreen);
        assert_eq!(
            settings.dock.item_order,
            vec!["apps", "clock", "add-widget"]
        );
        assert!(settings.onboarded);
    }

    #[test]
    fn migrates_version_two_and_puts_apps_after_start() {
        let mut value = serde_json::json!({
            "version": 2,
            "dock": {
                "position": "bottom", "size": "m", "mode": "pill", "theme": "dark",
                "style": "glass", "monitorId": null,
                "itemOrder": ["start", "clock", "add-widget"],
                "clock24h": false, "launchAtStartup": true, "autoHideInFullscreen": true
            },
            "taskbar": { "mode": "hidden" }
        });
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(
            settings.dock.item_order,
            vec!["start", "apps", "clock", "add-widget"]
        );
        assert_eq!(settings.dock.start_action, StartAction::Launcher);
        assert!(settings.apps.group_windows);
        assert!(!AppSettings::migrate(&mut value));
    }

    #[test]
    fn migrates_version_three_without_changing_it() {
        let mut original = serde_json::to_value(AppSettings::default()).unwrap();
        original["version"] = serde_json::json!(3);
        original["dock"]["style"] = serde_json::json!("midnight");
        let mut value = original.clone();
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert_eq!(settings.dock.style, DockStyle::Midnight);
        assert_eq!(settings.dock.spacing, DockSpacing::Even);
        assert!(!settings.onboarded);
        original["version"] = serde_json::json!(SETTINGS_VERSION);
        assert_eq!(value, original);
        assert!(!AppSettings::migrate(&mut value));
    }

    #[test]
    fn migrates_version_four_and_defaults_spacing() {
        let mut value = serde_json::json!({
            "version": 4,
            "dock": {
                "position": "left", "size": "l", "mode": "full", "theme": "light",
                "style": "ink", "monitorId": null,
                "itemOrder": ["clock"],
                "clock24h": true, "launchAtStartup": false
            }
        });
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert_eq!(settings.dock.style, DockStyle::Ink);
        assert_eq!(settings.dock.spacing, DockSpacing::Even);
        assert_eq!(settings.dock.position, crate::geometry::DockPosition::Left);
        assert!(!AppSettings::migrate(&mut value));
    }

    #[test]
    fn migrates_version_five_and_leaves_developer_widgets_off() {
        let mut value = serde_json::to_value(AppSettings::default()).unwrap();
        value["version"] = serde_json::json!(5);
        value["widgets"]
            .as_object_mut()
            .unwrap()
            .retain(|key, _| key == "weather" || key == "focus");
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert!(settings.widgets.projects.roots.is_empty());
        assert!(settings.widgets.vault.path.is_empty());
        assert!(!settings.widgets.ci.enabled);
        assert!(!AppSettings::migrate(&mut value));
    }

    #[test]
    fn migrates_version_six_without_widget_options() {
        let mut value = serde_json::to_value(AppSettings::default()).unwrap();
        value["version"] = serde_json::json!(6);
        value["widgets"].as_object_mut().unwrap().remove("options");
        assert!(AppSettings::migrate(&mut value));
        let settings = parse(&value).unwrap();
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert!(settings.widgets.options.is_empty());
    }

    #[test]
    fn checks_github_repo_names() {
        assert!(is_valid_github_repo("deathboy20/OpenDock"));
        assert!(is_valid_github_repo("a-b/c.d_e"));
        assert!(!is_valid_github_repo("OpenDock"));
        assert!(!is_valid_github_repo("-x/y"));
        assert!(!is_valid_github_repo("x/.."));
        assert!(!is_valid_github_repo("x/y/z"));
        assert!(!is_valid_github_repo("x/a b"));
    }

    #[test]
    fn new_installs_start_unonboarded() {
        assert!(!AppSettings::default().onboarded);
    }
}
