//! Background services. Each one owns a thread, reads the OS or the network, writes to the
//! store, and publishes facts on the event bus for widgets and rules.

pub mod apps;
pub mod automation;
pub mod calendar;
pub mod ci;
pub mod desktop;
pub mod focus;
pub mod local_ai;
pub mod projects;
pub mod vault;
pub mod weather;
pub mod windows;

use std::sync::atomic::Ordering;
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use chrono::{Datelike, Local, Timelike};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::engine::bus::BusEvent;
use crate::platform::{self, CpuSampler};
use crate::state::{notify_changed, AppState};

const WEATHER_INTERVAL: Duration = Duration::from_secs(30 * 60);
const CALENDAR_INTERVAL: Duration = Duration::from_secs(15 * 60);
const PROJECTS_INTERVAL: Duration = Duration::from_secs(2 * 60);
const LOCAL_AI_INTERVAL: Duration = Duration::from_secs(60);
const CI_INTERVAL: Duration = Duration::from_secs(5 * 60);

/// A widget's own refresh setting, kept within what its source can bear.
pub fn refresh_interval(
    settings: &crate::settings::AppSettings,
    widget: &str,
    default: Duration,
    min: Duration,
) -> Duration {
    settings
        .widgets
        .options
        .get(widget)
        .and_then(|o| o.refresh_seconds)
        .map(|s| Duration::from_secs(u64::from(s)).max(min))
        .unwrap_or(default)
}

/// Lets commands ask a polling service to refresh now.
pub struct Wakers {
    weather: Mutex<Sender<()>>,
    calendar: Mutex<Sender<()>>,
    projects: Mutex<Sender<()>>,
    local_ai: Mutex<Sender<()>>,
    ci: Mutex<Sender<()>>,
}

impl Wakers {
    pub fn wake_weather(&self) {
        if let Ok(tx) = self.weather.lock() {
            let _ = tx.send(());
        }
    }

    pub fn wake_calendar(&self) {
        if let Ok(tx) = self.calendar.lock() {
            let _ = tx.send(());
        }
    }

    pub fn wake_projects(&self) {
        if let Ok(tx) = self.projects.lock() {
            let _ = tx.send(());
        }
    }

    pub fn wake_local_ai(&self) {
        if let Ok(tx) = self.local_ai.lock() {
            let _ = tx.send(());
        }
    }

    pub fn wake_ci(&self) {
        if let Ok(tx) = self.ci.lock() {
            let _ = tx.send(());
        }
    }
}

pub fn emit_focus(app: &AppHandle, state: &AppState) {
    let _ = app.emit("focus:state", state.focus.snapshot(&state.db));
}

pub fn start_all(app: &AppHandle) {
    let (weather_tx, weather_rx) = channel();
    let (calendar_tx, calendar_rx) = channel();
    let (projects_tx, projects_rx) = channel();
    let (local_ai_tx, local_ai_rx) = channel();
    let (ci_tx, ci_rx) = channel();
    app.manage(Wakers {
        weather: Mutex::new(weather_tx),
        calendar: Mutex::new(calendar_tx),
        projects: Mutex::new(projects_tx),
        local_ai: Mutex::new(local_ai_tx),
        ci: Mutex::new(ci_tx),
    });
    spawn_system(app.clone());
    spawn_media(app.clone());
    apps::spawn_windows(app.clone());
    apps::spawn_volume(app.clone());
    spawn_fullscreen(app.clone());
    spawn_focus(app.clone());
    spawn_scheduler(app.clone());
    spawn_weather(app.clone(), weather_rx);
    spawn_calendar(app.clone(), calendar_rx);
    spawn_projects(app.clone(), projects_rx);
    spawn_local_ai(app.clone(), local_ai_rx);
    spawn_ci(app.clone(), ci_rx);
}

fn spawn_system(app: AppHandle) {
    thread::spawn(move || {
        let mut sampler = CpuSampler::default();
        let mut tick: u64 = 0;
        let mut last_battery = None;
        loop {
            thread::sleep(Duration::from_secs(2));
            tick += 1;
            let state = app.state::<AppState>();
            let previous_mode = state.taskbar.status().mode;
            state.taskbar.reassert();
            if state.taskbar.status().mode != previous_mode {
                if let Some(dock) = app.get_webview_window("main") {
                    let length = state.live.dock_length.lock().ok().and_then(|v| *v);
                    let _ = crate::dock_layout::apply_dock_layout(&dock, &state.settings(), length);
                }
            }
            let stats = platform::system_stats(&mut sampler);
            let _ = app.emit("system:stats", &stats);
            if let Ok(mut slot) = state.live.stats.lock() {
                *slot = Some(stats.clone());
            }
            if tick % 5 == 0 {
                if let (Some(cpu), Some(memory)) = (stats.cpu, stats.memory) {
                    state.publish(BusEvent::new(
                        "system.cpu.sampled",
                        "system",
                        json!({ "cpu": cpu.round(), "memory": memory.round() }),
                    ));
                }
            }
            if stats.battery != last_battery {
                if let Some(battery) = stats.battery {
                    state.publish(BusEvent::new(
                        "system.battery.changed",
                        "system",
                        json!({ "percent": battery.percent, "charging": battery.charging }),
                    ));
                }
                last_battery = stats.battery;
            }
        }
    });
}

fn spawn_media(app: AppHandle) {
    thread::spawn(move || loop {
        let current = platform::media_state();
        let state = app.state::<AppState>();
        let previous = state
            .live
            .media
            .lock()
            .map(|m| m.clone())
            .unwrap_or_default();
        if current != previous {
            if let Ok(mut slot) = state.live.media.lock() {
                *slot = current.clone();
            }
            let _ = app.emit("media:state", &current);
            if current.playing != previous.playing || current.title != previous.title {
                state.publish(BusEvent::new(
                    "media.state.changed",
                    "media",
                    json!({
                        "playing": current.playing,
                        "title": current.title,
                        "artist": current.artist,
                        "app": current.app,
                    }),
                ));
            }
        }
        thread::sleep(Duration::from_millis(1500));
    });
}

fn spawn_fullscreen(app: AppHandle) {
    thread::spawn(move || {
        let mut dock_hidden = false;
        let mut was_fullscreen = false;
        loop {
            thread::sleep(Duration::from_millis(400));
            let Some(dock) = app.get_webview_window("main") else {
                break;
            };
            let state = app.state::<AppState>();
            let own = platform::raw_handle(&dock);
            let fullscreen = platform::foreground_fullscreen(own);
            state.live.fullscreen.store(fullscreen, Ordering::Relaxed);
            if fullscreen != was_fullscreen {
                was_fullscreen = fullscreen;
                state.publish(BusEvent::new(
                    "system.fullscreen.changed",
                    "system",
                    json!({ "active": fullscreen }),
                ));
            }
            let should_hide = fullscreen && state.settings().dock.auto_hide_in_fullscreen;
            if should_hide && !dock_hidden {
                let _ = dock.hide();
                windows::hide_flyout(&app);
                windows::hide_toast(&app);
                dock_hidden = true;
                let _ = app.emit("dock:fullscreen-hidden", ());
            } else if !should_hide && dock_hidden {
                let _ = dock.show();
                dock_hidden = false;
                let _ = app.emit("dock:fullscreen-visible", ());
            }
        }
    });
}

fn spawn_focus(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let state = app.state::<AppState>();
        let break_minutes = state.settings().widgets.focus.break_minutes;
        if state.focus.tick(&state.db, &state.bus, break_minutes) {
            emit_focus(&app, &state);
        }
    });
}

fn weekday_code(weekday: chrono::Weekday) -> &'static str {
    use chrono::Weekday::*;
    match weekday {
        Mon => "mon",
        Tue => "tue",
        Wed => "wed",
        Thu => "thu",
        Fri => "fri",
        Sat => "sat",
        Sun => "sun",
    }
}

fn spawn_scheduler(app: AppHandle) {
    thread::spawn(move || loop {
        let now = Local::now();
        let wait = 60 - u64::from(now.second());
        thread::sleep(Duration::from_secs(wait.max(1)));
        let now = Local::now();
        let state = app.state::<AppState>();
        let time = now.format("%H:%M").to_string();
        let date = now.format("%Y-%m-%d").to_string();
        state.publish(
            BusEvent::new(
                "time.tick",
                "clock",
                json!({ "time": time, "weekday": weekday_code(now.weekday()) }),
            )
            .with_dedupe(format!("{date} {time}")),
        );
        calendar::publish_starting(&state.db, &state.bus);
        let sun = state
            .live
            .weather
            .lock()
            .ok()
            .and_then(|w| w.as_ref().map(|w| (w.sunrise, w.sunset)));
        if let Some((sunrise, sunset)) = sun {
            let now_ms = now.timestamp_millis();
            for (name, at) in [("sun.sunrise", sunrise), ("sun.sunset", sunset)] {
                if let Some(at) = at {
                    if now_ms >= at && now_ms - at < 60_000 {
                        state.publish(
                            BusEvent::new(name, "weather", json!({}))
                                .with_dedupe(format!("{name}:{date}")),
                        );
                    }
                }
            }
        }
    });
}

fn wait_or_wake(rx: &Receiver<()>, interval: Duration) -> bool {
    match rx.recv_timeout(interval) {
        Ok(()) => {
            while rx.try_recv().is_ok() {}
            true
        }
        Err(RecvTimeoutError::Timeout) => true,
        Err(RecvTimeoutError::Disconnected) => false,
    }
}

fn spawn_weather(app: AppHandle, rx: Receiver<()>) {
    thread::spawn(move || {
        {
            let state = app.state::<AppState>();
            if let Some(cached) = weather::cached(&state.db) {
                if let Ok(mut slot) = state.live.weather.lock() {
                    *slot = Some(cached);
                }
            }
        }
        loop {
            let state = app.state::<AppState>();
            let settings = state.settings().widgets.weather;
            if let Some(snapshot) = weather::refresh(&state.db, &settings) {
                if let Some(event) = weather::rain_soon(&snapshot, crate::store::now_ms()) {
                    state.publish(event);
                }
                if let Ok(mut slot) = state.live.weather.lock() {
                    *slot = Some(snapshot.clone());
                }
                let _ = app.emit("weather:update", &snapshot);
            }
            if !wait_or_wake(&rx, WEATHER_INTERVAL) {
                break;
            }
        }
    });
}

fn spawn_calendar(app: AppHandle, rx: Receiver<()>) {
    thread::spawn(move || loop {
        let state = app.state::<AppState>();
        match calendar::sync_all(&state.db) {
            Ok(_) => {
                notify_changed(&app, "calendar");
                calendar::publish_starting(&state.db, &state.bus);
            }
            Err(error) => tracing::warn!(%error, "calendar sync failed"),
        }
        if !wait_or_wake(&rx, CALENDAR_INTERVAL) {
            break;
        }
    });
}

fn spawn_projects(app: AppHandle, rx: Receiver<()>) {
    thread::spawn(move || loop {
        let state = app.state::<AppState>();
        let roots = state.settings().widgets.projects.roots;
        let snapshot = projects::scan(&roots);
        if let Ok(mut slot) = state.live.projects.lock() {
            *slot = Some(snapshot.clone());
        }
        let _ = app.emit("projects:update", &snapshot);
        let interval = refresh_interval(
            &state.settings(),
            "projects",
            PROJECTS_INTERVAL,
            Duration::from_secs(30),
        );
        if !wait_or_wake(&rx, interval) {
            break;
        }
    });
}

/// Ollama is checked only while its widget is on the dock, so a PC without it sees no
/// requests at all, and the Privacy Ledger stays quiet.
fn spawn_local_ai(app: AppHandle, rx: Receiver<()>) {
    thread::spawn(move || loop {
        let state = app.state::<AppState>();
        let on_dock = state
            .settings()
            .dock
            .item_order
            .iter()
            .any(|id| id == local_ai::WIDGET);
        if on_dock {
            let snapshot = local_ai::check(&state.db);
            if let Ok(mut slot) = state.live.local_ai.lock() {
                *slot = Some(snapshot.clone());
            }
            let _ = app.emit("localAi:update", &snapshot);
        }
        let interval = refresh_interval(
            &state.settings(),
            local_ai::WIDGET,
            LOCAL_AI_INTERVAL,
            Duration::from_secs(15),
        );
        if !wait_or_wake(&rx, interval) {
            break;
        }
    });
}

/// CI status is opt-in: GitHub is contacted only while the widget is turned on in
/// settings, has repositories, and is on the dock.
fn spawn_ci(app: AppHandle, rx: Receiver<()>) {
    thread::spawn(move || loop {
        let state = app.state::<AppState>();
        let settings = state.settings();
        let ci_settings = &settings.widgets.ci;
        let on_dock = settings.dock.item_order.iter().any(|id| id == ci::WIDGET);
        let token = ci::token();
        let snapshot = if ci_settings.enabled && on_dock && !ci_settings.repos.is_empty() {
            ci::check(&state.db, &ci_settings.repos, token.as_deref())
        } else {
            ci::CiSnapshot {
                enabled: ci_settings.enabled,
                has_token: token.is_some(),
                checked_at: crate::store::now_ms(),
                ..Default::default()
            }
        };
        if let Ok(mut slot) = state.live.ci.lock() {
            *slot = Some(snapshot.clone());
        }
        let _ = app.emit("ci:update", &snapshot);
        // GitHub allows 60 unauthenticated requests an hour, so CI never polls faster than 1 min.
        let interval =
            refresh_interval(&settings, ci::WIDGET, CI_INTERVAL, Duration::from_secs(60));
        if !wait_or_wake(&rx, interval) {
            break;
        }
    });
}
