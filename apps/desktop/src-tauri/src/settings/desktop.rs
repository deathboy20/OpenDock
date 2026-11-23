//! The desktop widgets layer: widgets placed on the desktop in their own borderless windows,
//! behind other windows. Positions snap to a grid and are kept per monitor, relative to that
//! monitor's top-left corner, in logical pixels. Mirrors `packages/config-schema/src/desktop.ts`.

use serde::{Deserialize, Serialize};

use crate::engine::rules::is_valid_id;

pub const MAX_DESKTOP_WIDGETS: usize = 12;
pub const MIN_GRID: u32 = 8;
pub const MAX_GRID: u32 = 64;
const MAX_OFFSET: i32 = 16_384;
/// Widgets that are part of the dock itself and make no sense on their own.
pub const DOCK_ONLY: [&str; 5] = ["start", "apps", "tray", "volume", "add-widget"];

/// Size of a desktop widget window, in logical pixels.
pub const WIDGET_WIDTH: i32 = 252;
pub const WIDGET_HEIGHT: i32 = 76;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopWidget {
    pub id: String,
    /// The monitor's name, as Windows reports it. `None` means the primary monitor.
    #[serde(default)]
    pub monitor_id: Option<String>,
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct DesktopSettings {
    pub grid: u32,
    pub widgets: Vec<DesktopWidget>,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            grid: 16,
            widgets: Vec::new(),
        }
    }
}

impl DesktopSettings {
    pub fn validate(&self) -> Result<(), String> {
        if !(MIN_GRID..=MAX_GRID).contains(&self.grid) {
            return Err(format!("the desktop grid must be {MIN_GRID}-{MAX_GRID} px"));
        }
        if self.widgets.len() > MAX_DESKTOP_WIDGETS {
            return Err(format!("at most {MAX_DESKTOP_WIDGETS} desktop widgets"));
        }
        for (index, widget) in self.widgets.iter().enumerate() {
            if !is_valid_id(&widget.id) || DOCK_ONLY.contains(&widget.id.as_str()) {
                return Err(format!("{} can't go on the desktop", widget.id));
            }
            if self.widgets[..index].iter().any(|w| w.id == widget.id) {
                return Err(format!("{} is on the desktop twice", widget.id));
            }
            if widget.monitor_id.as_ref().is_some_and(|m| m.len() > 256) {
                return Err("monitor name is too long".into());
            }
            if !(-MAX_OFFSET..=MAX_OFFSET).contains(&widget.x)
                || !(-MAX_OFFSET..=MAX_OFFSET).contains(&widget.y)
            {
                return Err("desktop widget position out of range".into());
            }
        }
        Ok(())
    }
}

/// Rounds to the nearest grid line.
pub fn snap(value: i32, grid: i32) -> i32 {
    let grid = grid.max(1);
    (value as f64 / grid as f64).round() as i32 * grid
}

/// A monitor as `[x, y, width, height]` in logical pixels.
pub type Rect = [i32; 4];

/// Keeps a widget of `size` fully inside the monitor.
pub fn clamp_inside(x: i32, y: i32, size: (i32, i32), monitor: Rect) -> (i32, i32) {
    let [_, _, w, h] = monitor;
    (
        x.clamp(0, (w - size.0).max(0)),
        y.clamp(0, (h - size.1).max(0)),
    )
}

/// Where a widget the user dropped at `absolute` is saved: relative to its monitor, snapped
/// to the grid and kept on screen.
pub fn settle(absolute: (i32, i32), size: (i32, i32), monitor: Rect, grid: u32) -> (i32, i32) {
    let grid = grid.clamp(MIN_GRID, MAX_GRID) as i32;
    let rel = (absolute.0 - monitor[0], absolute.1 - monitor[1]);
    let snapped = (snap(rel.0, grid), snap(rel.1, grid));
    clamp_inside(snapped.0, snapped.1, size, monitor)
}

/// Where a saved widget goes on screen. A monitor that has shrunk keeps it on screen.
pub fn screen_position(widget: &DesktopWidget, size: (i32, i32), monitor: Rect) -> (i32, i32) {
    let (x, y) = clamp_inside(widget.x, widget.y, size, monitor);
    (monitor[0] + x, monitor[1] + y)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn widget(id: &str, x: i32, y: i32) -> DesktopWidget {
        DesktopWidget {
            id: id.into(),
            monitor_id: None,
            x,
            y,
        }
    }

    #[test]
    fn snaps_to_the_grid() {
        assert_eq!(snap(23, 16), 16);
        assert_eq!(snap(25, 16), 32);
        assert_eq!(snap(-9, 16), -16);
        assert_eq!(snap(5, 0), 5);
    }

    #[test]
    fn settles_relative_to_the_monitor_and_on_screen() {
        let second = [1920, 0, 1280, 1024];
        assert_eq!(settle((1920 + 101, 203), (252, 76), second, 16), (96, 208));
        assert_eq!(settle((5000, -50), (252, 76), second, 16), (1280 - 252, 0));
        let widget = DesktopWidget {
            id: "clock".into(),
            monitor_id: Some("\\\\.\\DISPLAY2".into()),
            x: 96,
            y: 208,
        };
        assert_eq!(screen_position(&widget, (252, 76), second), (2016, 208));
        assert_eq!(
            screen_position(&widget, (252, 76), [0, 0, 300, 200]),
            (48, 124)
        );
    }

    #[test]
    fn validates_desktop_settings() {
        let mut settings = DesktopSettings {
            grid: 16,
            widgets: vec![widget("clock", 32, 32), widget("projects", 32, 128)],
        };
        settings.validate().unwrap();
        settings.widgets.push(widget("clock", 0, 0));
        assert!(settings.validate().is_err());
        assert!(DesktopSettings {
            grid: 4,
            widgets: vec![]
        }
        .validate()
        .is_err());
        assert!(DesktopSettings {
            grid: 16,
            widgets: vec![widget("start", 0, 0)]
        }
        .validate()
        .is_err());
        assert!(DesktopSettings {
            grid: 16,
            widgets: vec![widget("clock", 99_999, 0)]
        }
        .validate()
        .is_err());
    }
}
