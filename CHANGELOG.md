# Changelog

All notable changes to OpenDock are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/). Until 1.0, minor versions may include breaking changes; they are called out below.

## [Unreleased]

## [0.4.0] - 2026-11-23

Developer widgets, skins that can change the dock's shape and each widget's look, desktop widgets, scenes, and a daily check for new versions.

### Added

- **Projects widget.** Lists the git repositories in the folders you choose, with branch, uncommitted changes and ahead or behind. Open one in Cursor, VS Code, a terminal, GitHub Desktop or File Explorer, or read its `HANDOFF.md` in the panel. A new **Developer widgets** page in the hub holds the folders.
- **Vault capture widget.** Type a note and it is added, with the time, to `Inbox/YYYY-MM-DD.md` in your Obsidian vault. Open today's note or the vault in Obsidian from the panel.
- **Local AI widget.** Shows whether Ollama is running on this PC, your models and the ones in memory, and answers a quick question from the model you pick. It talks only to `127.0.0.1:11434`, and only while it is on the dock.
- **CI status widget.** The latest GitHub Actions run for the repositories you list, with failing runs first. Off by default; it contacts only `api.github.com`, and an optional token is kept in Windows Credential Manager.
- **Widget options.** A new **Customise** page gives each dock widget its own label, layout (dock size, icon only or detailed), accent swatch and, for Projects, Local AI and CI status, how often it checks.
- **Skins.** Five built-in skins (Graphite, Paper, Dusk, Forest and High contrast) restyle every OpenDock window on top of the dock style, with dark and light values measured for contrast. Import a skin from JSON or a file, and export your own. Skins can only set listed design tokens to checked values.
- **Skin interfaces.** Skins can now change the dock's shape and each widget's look, not only its colours. New layouts (one bar, islands of related widgets, or a chip per widget), a slim thickness, and a tint for bright or busy wallpapers, with a live preview over sample wallpapers. Battery, System, Clock, Day progress, Now playing, Focus and Weather each have two to four looks (for example a battery ring, dots or gauge, and an analog clock). Five more built-in skins use them: Islands, Daylight, Console, Instruments and Float.
- **Undo for skins and a reset per widget.** Switching skins offers Undo, which restores only the look. Each widget's options have a Reset button. First-run setup now offers a few skins to start with.
- **Scenes.** Save the dock's widgets, look, skin, quiet hours and automations as a named scene, and switch between scenes from Customise or the dock menu. Scenes never change the taskbar mode.
- **Desktop widgets.** Place widgets on the desktop in their own borderless windows behind your other windows. Drag to move; they snap to an 8, 16 or 32 px grid and remember their position per monitor.
- **Update checks.** Once a day OpenDock asks GitHub whether a newer release exists, and the dock menu and Dock settings offer the download. On by default, anonymous, shown in the Privacy ledger, and easy to turn off ([ADR 0006](docs/adr/0006-update-checks.md)).
- The widget gallery labels widgets that only talk to apps on this PC as **This PC only**.

### Changed

- Settings move to version 7: version 6 adds the developer widgets and version 7 adds widget options, skins, scenes and desktop widgets. Older files are migrated automatically, and everything new starts empty or off.
- `net.rs` can now send headers and JSON bodies, and allows plain `http://` only to declared hosts on this PC (`127.0.0.1`), for local services such as Ollama.
- Going back to 0.3.0 after running 0.4.0 isn't supported: 0.3.0 can't read version 7 settings, so it sets the file aside as `settings.invalid-<time>.json` and starts with defaults.

### Fixed

- The notification strip no longer appears with a native title bar. It is now a non-focusable window shown the normal way, so it still never takes focus.
- App icons that Windows couldn't hand over at first (for example right after sign-in) are asked for again instead of staying as a letter until OpenDock restarts.
- Very long names made of dashes or symbols no longer slow down naming a rule or a skin, or adding a folder or repository. Text is now trimmed without regular expressions that can backtrack.

## [0.3.0] - 2026-11-07

Live dock settings, a restore-the-taskbar command, experimental Linux and macOS packages, and a dock you can try in the browser.

### Added

- Dock settings opens on a live dock. Drag it to an edge, change style, shape, icon size and spacing, and use Undo or Reset. Arrow keys move the dock, Space picks up a widget, and the spacing bar takes arrow keys too. Settings version 5 stores spacing (tight, even or roomy). Older files gain even spacing.
- **Restore the Windows taskbar** in the dock menu and the quick-actions tray. It puts the taskbar back without waiting for the guard process.
- The homepage has a dock you can use in the browser: open apps, search from Start, change the volume, switch skins, and turn widgets on and off.
- Now playing opens from the dock, not a separate block. Previous and next switch between *Just 2 Minutes of Fusion Jazz!* by Giulio Carmassi and *Tokyo* by Toshiki Soejima. YouTube loads only while that widget is open.
- Windows installers, Linux x64/arm64 AppImage/DEB/RPM packages and a universal macOS DMG, with a combined checksum manifest. A version tag publishes a draft GitHub release. Stable versions are not marked as pre-release, so publishing the draft makes it Latest. Linux and macOS remain experimental build-only artifacts.

### Changed

- The website and the README describe taskbar restore as the exits OpenDock can see, including the gap when Windows kills OpenDock and the guard together. The manual results are in `docs/testing-matrix.md`.
- The footer link that said Pricing now says Free. There is no paid plan.
- Contributor branches now run `develop` → `staging` → `main`.

### Fixed

- Taskbar replacement now requires a running recovery guard, restores the original state after a partial failure, and retains recovery data until restoration succeeds. Secondary taskbars are included in visibility checks. Startup failures open Dock settings with an error, and the dock is shown after initial layout.

## [0.2.0] - 2026-10-21

The first release that can stand in for the Windows taskbar.

### Added

- **Taskbar replacement.** A new *Replace* mode hides the Windows taskbar and reserves the dock's screen edge, so maximised windows never sit under the dock. Auto-hide and keep-the-taskbar modes remain available.
- **Apps on the dock.** Pinned apps and open windows, grouped by app with a window count, running and active indicators, and optional window titles. Click to switch, click again to minimise, Shift-click or middle-click for a new window.
- **Live window previews.** Right-click an app to see a live preview of each window, switch to it, close it, open a new window, or pin and unpin the app.
- **Start launcher.** Search installed apps from the Start button, pin them, and lock, sleep, sign out, restart or shut down. Destructive power actions ask for a second click.
- **Volume and quick actions.** A volume widget (scroll to change, middle-click to mute, click for a slider and presets) and buttons for Windows quick settings, notifications and show desktop.
- **Welcome setup.** First launch walks through the taskbar choice, importing your pinned taskbar apps, and look and feel.
- **Apps & taskbar settings page.** Reorder, add and remove pins, import from the Windows taskbar, and choose grouping and titles.
- **Widget gallery.** Fourteen widgets in three sizes with loading, empty and error states: Start, Apps, Volume, Quick actions, Clock, Now playing, Focus timer, Todos, Notes, Next event, System, Battery, Weather and Day progress.
- **Local data layer.** A versioned SQLite store for todos, notes, focus sessions, rules, activity, calendars, a forecast cache and the network log.
- **Automation Studio.** Rules made of events, conditions and actions, with eleven recipes, dry runs, an activity log and Undo. New events: `app.window.opened` and `app.window.focused`.
- **Calendars.** Read-only iCal subscriptions. Feed links are stored in the OS keychain.
- **Privacy Ledger.** A record of every network request each widget made, kept on your device.
- **Guaranteed taskbar restore.** A guard process restores the taskbar if OpenDock crashes, and the uninstaller restores it and removes the sign-in entry.
- **Three more dock styles.** Minimal, Neon and Ink sit alongside Glass, Solid and Midnight.
- **A scrolling apps row.** When the dock reaches the edge of the screen, the apps slide sideways. The Start button, volume, tray, clock and system widgets stay put. New app icons animate in, and the motion is skipped when reduced motion is on.
- The website follows the system colour scheme, with a Light, Dark and System control that is remembered on this device. The homepage and the README show a screenshot of OpenDock running on Windows.

### Changed

- Settings move to version 4. Older settings files are migrated automatically. Version 3 only added the Apps widget after Start; version 4 adds the new dock styles.
- The Start button opens the OpenDock launcher by default. You can switch back to Windows Start in Dock settings.

### Fixed

- Clicking a different app while another app's panel was closing no longer gets swallowed.

## [0.1.0-milestone-2] - 2026-10-21

### Added

- Tauri 2 and React monorepo.
- Floating dock prototype with a live clock and persisted layout.
- Fullscreen auto-hide on Windows.
- Settings stored in `settings.json`, validated in Rust and with Zod.
- Marketing website.

[Unreleased]: https://github.com/isaacobenzy/OpenDock/compare/v0.4.0...develop
[0.4.0]: https://github.com/isaacobenzy/OpenDock/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/isaacobenzy/OpenDock/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/isaacobenzy/OpenDock/compare/v0.1.0-milestone-2...v0.2.0
[0.1.0-milestone-2]: https://github.com/isaacobenzy/OpenDock/releases/tag/v0.1.0-milestone-2
