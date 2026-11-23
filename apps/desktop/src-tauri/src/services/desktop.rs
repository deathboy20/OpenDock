//! Keeps one borderless, always-on-bottom window per desktop widget in step with settings.
//! Window labels are `desk-<widget id>`; the webview reads the id from its label.

use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Monitor, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::settings::desktop::{self, DesktopWidget, Rect, WIDGET_HEIGHT, WIDGET_WIDTH};
use crate::settings::AppSettings;

pub const LABEL_PREFIX: &str = "desk-";

pub fn widget_id(label: &str) -> Option<&str> {
    label.strip_prefix(LABEL_PREFIX)
}

fn logical_rect(monitor: &Monitor) -> Rect {
    let scale = monitor.scale_factor();
    let pos = monitor.position().to_logical::<f64>(scale);
    let size = monitor.size().to_logical::<f64>(scale);
    [
        pos.x.round() as i32,
        pos.y.round() as i32,
        size.width.round() as i32,
        size.height.round() as i32,
    ]
}

/// The widget's saved monitor, or the primary one when that monitor isn't connected.
fn monitor_for(app: &AppHandle, widget: &DesktopWidget) -> Option<Monitor> {
    let monitors = app.available_monitors().ok()?;
    widget
        .monitor_id
        .as_ref()
        .and_then(|id| {
            monitors
                .iter()
                .find(|m| m.name().is_some_and(|n| n == id))
                .cloned()
        })
        .or_else(|| app.primary_monitor().ok().flatten())
        .or_else(|| monitors.into_iter().next())
}

fn place(app: &AppHandle, window: &WebviewWindow, widget: &DesktopWidget) -> Result<(), String> {
    let Some(monitor) = monitor_for(app, widget) else {
        return Ok(());
    };
    let (x, y) = desktop::screen_position(
        widget,
        (WIDGET_WIDTH, WIDGET_HEIGHT),
        logical_rect(&monitor),
    );
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

/// Opens, moves and closes desktop widget windows to match `settings.desktop`.
pub fn sync(app: &AppHandle, settings: &AppSettings) {
    let wanted = &settings.desktop.widgets;
    for (label, window) in app.webview_windows() {
        if let Some(id) = widget_id(&label) {
            if !wanted.iter().any(|w| w.id == id) {
                let _ = window.close();
            }
        }
    }
    for widget in wanted {
        let label = format!("{LABEL_PREFIX}{}", widget.id);
        let window = match app.get_webview_window(&label) {
            Some(window) => window,
            None => {
                let built =
                    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
                        .title("OpenDock widget")
                        .inner_size(f64::from(WIDGET_WIDTH), f64::from(WIDGET_HEIGHT))
                        .decorations(false)
                        .transparent(true)
                        .shadow(false)
                        .always_on_bottom(true)
                        .skip_taskbar(true)
                        .resizable(false)
                        .focused(false)
                        .visible(false)
                        .build();
                match built {
                    Ok(window) => window,
                    Err(error) => {
                        tracing::warn!(%error, widget = widget.id, "couldn't open desktop widget");
                        continue;
                    }
                }
            }
        };
        let _ = window.set_size(LogicalSize::new(
            f64::from(WIDGET_WIDTH),
            f64::from(WIDGET_HEIGHT),
        ));
        if let Err(error) = place(app, &window, widget) {
            tracing::warn!(%error, widget = widget.id, "couldn't place desktop widget");
        }
        let _ = window.show();
    }
}

/// Reads where the user dropped a widget, snaps it, and returns the settings to save.
pub fn settle(
    app: &AppHandle,
    window: &WebviewWindow,
    settings: &AppSettings,
) -> Option<AppSettings> {
    let id = widget_id(window.label())?;
    let index = settings.desktop.widgets.iter().position(|w| w.id == id)?;
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| monitor_for(app, &settings.desktop.widgets[index]))?;
    let scale = window.scale_factor().ok()?;
    let pos = window.outer_position().ok()?.to_logical::<f64>(scale);
    let rect = logical_rect(&monitor);
    let (x, y) = desktop::settle(
        (pos.x.round() as i32, pos.y.round() as i32),
        (WIDGET_WIDTH, WIDGET_HEIGHT),
        rect,
        settings.desktop.grid,
    );
    let mut next = settings.clone();
    let widget = &mut next.desktop.widgets[index];
    widget.x = x;
    widget.y = y;
    widget.monitor_id = monitor.name().map(|n| n.to_string());
    let _ = window.set_position(LogicalPosition::new(rect[0] + x, rect[1] + y));
    Some(next)
}
