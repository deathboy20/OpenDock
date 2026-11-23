# User guide

A tour of what OpenDock can do once it's installed. If you haven't installed it yet, start with [installation.md](installation.md).

## The dock

The dock sits on one edge of your screen. Everything on it is a **widget**, and you can rearrange them by dragging.

- **Right-click an empty part of the dock** for the dock menu: size, theme, style, taskbar mode, the widget gallery, Automation Studio, settings and Quit.
- **Right-click a widget** to remove it or open its settings.
- **Click a widget** to open its panel, for example the month view from the clock or the full forecast from the weather.

**Dock settings → Appearance** shows the dock on a desk. Drag it to an edge, or focus the desk and use the arrow keys. Space picks up a widget so the arrow keys can reorder it. The bar at the end of the dock sets spacing (tight, even or roomy), separate from icon size. Style, shape, icon size, theme and the 24-hour clock apply straight away. **Undo** and **Reset** stay at the top of that section. During fullscreen games, videos and presentations the dock hides itself; turn that off in **Dock settings → Behaviour**.

## Apps and windows

The **Apps** widget is what replaces the taskbar. It shows your pinned apps first, then every other app with an open window.

| You do | OpenDock does |
| --- | --- |
| Click an app that isn't running | Starts it |
| Click an app with one window | Brings it to the front, or minimises it if it's already in front |
| Click an app with several windows | Shows its windows so you can pick one |
| Shift-click or middle-click | Opens a new window |
| Right-click | Shows live previews of every window, plus *New window*, *Pin*, *Close window* and *Close all* |

A short line under an icon means the app is running; a longer, coloured line marks the window in front. A number shows how many windows an app has.

Manage pins in **Apps & taskbar**: reorder them, add apps by searching, or import your Windows taskbar pins. You can also turn off grouping, so each window gets its own icon, and show window titles next to icons.

## Start launcher

Click **Start** to open the launcher.

- Start typing to search every installed app. Use the arrow keys and Enter, or click.
- Pin or unpin an app with the pin button next to it.
- The bottom row has **Lock**, **Sleep**, **Sign out**, **Restart** and **Shut down**. The last three ask you to click twice, so a stray click can't end your session.
- **Windows Start** opens the regular Windows menu. To make the Start button always do that, change *Start button* in **Dock settings**.

## Volume and quick actions

- **Volume:** scroll over it to change the volume, middle-click to mute, click for a slider and presets.
- **Quick actions:** buttons for Windows quick settings (Wi-Fi, Bluetooth, sound output), notifications, and show desktop.

## Widgets

Open the **Widget gallery** from the dock menu to add widgets. Each one shows what it stores and which internet hosts, if any, it contacts.

| Widget | What it shows | Network |
| --- | --- | --- |
| Start | Launcher with search, pins and power | None |
| Apps | Pinned apps and open windows | None |
| Volume | Output volume and mute | None |
| Quick actions | Quick settings, notifications, show desktop | None |
| Clock | Time and date; panel with month and agenda | None |
| Now playing | Track and controls for the current media app | None |
| Focus timer | Pomodoro rounds and a week of history | None |
| Todos | A local to-do list | None |
| Notes | Pinnable scratch notes | None |
| Next event | Countdown to your next calendar event | Your calendar host |
| System | CPU and memory | None |
| Battery | Charge level and state | None |
| Weather | Conditions, next hours and week | Open-Meteo |
| Day progress | How much of the day, week and year has passed | None |
| Projects | Git repositories in your project folders, with branch and changes | None |
| Vault capture | A quick note box for your Obsidian vault's Inbox | None |
| Local AI | Ollama status, models and a quick prompt | Only Ollama on this PC (`127.0.0.1`) |
| CI status | The latest GitHub Actions run per repository (off until you turn it on) | GitHub (`api.github.com`) |

## Developer widgets

Set these up in **Developer widgets** in the hub.

### Projects

Add the folders your repositories live in, for example `D:\Gitfiles`. OpenDock lists every git repository in each folder and one or two levels below it (so `D:\Gitfiles\SOKO\map-dashboard` is found too). Folders whose names start with a dot, and `node_modules`, `target`, `dist` and `build`, are skipped. The list refreshes every two minutes, when you change the folders, or when you press **Check again**.

Each repository shows its branch, how many files have uncommitted changes, and how far it is ahead of or behind its upstream. Select one to open it in **Cursor**, **VS Code**, a **Terminal** (Windows Terminal if installed, otherwise PowerShell), **GitHub Desktop** or **Files** (File Explorer). If the repository has a `HANDOFF.md`, **HANDOFF.md** shows it in the panel as plain text.

The widget needs Git for Windows. It runs `git status` in each repository and never fetches, so "behind" is measured against the last time you fetched. It only opens or reads folders it found in your project folders.

### Vault capture

Enter your Obsidian vault folder, for example `C:\Users\you\Documents\Vault`. Each capture is added to `Inbox/YYYY-MM-DD.md` in that folder as a list item with the time, such as `- 09:30 Call Ama`; lines after the first are indented under it. The note and the `Inbox` folder are created the first time. OpenDock writes nothing else in the vault, and refuses to write through a link that points outside it.

**Open today's note** and **Open vault in Obsidian** use Obsidian's `obsidian://open` link, so Obsidian must be installed. Ctrl+Enter saves.

### Local AI

Shows whether [Ollama](https://ollama.com) is running on this PC, the models you have pulled, and the ones loaded in memory with how much GPU memory they use. Pick a model, type a question and press **Ask**; the answer appears in the panel. The first answer from a model that isn't loaded takes longer while Ollama loads it.

OpenDock talks only to `http://127.0.0.1:11434`, the address Ollama listens on, and only while the Local AI widget is on the dock (every minute, or when you press **Check again**). Each check shows in the Privacy Ledger under `local-ai`. Prompts and answers are not saved.

### CI status

CI status is off until you turn on **Check GitHub Actions** and add repositories as `owner/name` (you can paste a GitHub link). While it is on and the widget is on the dock, OpenDock asks `api.github.com` for the latest Actions run of each repository every five minutes. Each repository shows **Passing**, **Failing**, **Running**, **Cancelled** or **No runs yet**, with the workflow, branch and time. Select one to open the run on github.com.

Without a token GitHub allows 60 requests an hour and shows public repositories only. For private repositories, create a fine-grained token with read-only access to Actions and paste it under **GitHub token**. It is stored in Windows Credential Manager (service `OpenDock`, account `github:token`), sent only to `api.github.com`, and never shown again. **Remove** deletes it.

## Calendars

In **Calendars**, paste the secret iCal address from Google Calendar, Outlook, iCloud or any other provider. OpenDock reads it every 15 minutes and keeps events on your device. The address itself is stored in Windows Credential Manager, not in a file.

## Automation Studio

Rules make the dock act for you. Each rule has:

- **When:** an event, such as *a calendar event is about to start*, optionally with a filter (*within 5 minutes*).
- **Unless:** conditions that stop it, such as *during quiet hours*.
- **Then:** actions, such as *pause media* and *show a toast*.

Start from a **recipe** (Meeting mode, Low battery warning, Sunset dark mode, Pause music for calls and others) and adjust it. **Dry run** shows what a rule would do right now. **Activity** lists every rule that ran and why, and actions marked *undoable* can be undone from the toast or the activity list. Set quiet hours in **Dock settings**.

## Privacy Ledger

**Privacy** in the hub lists every internet request OpenDock made: which widget, which host, when and how many times. OpenDock never sends telemetry, and widgets can only contact the hosts they declare.

## Taskbar modes

| Mode | What happens |
| --- | --- |
| Replace the taskbar | The taskbar is hidden and the dock reserves its edge of the screen, so maximised windows stop at the dock |
| Auto-hide | The taskbar slides away and reappears when you point at the screen edge |
| Keep the taskbar | Windows behaves as usual alongside the dock |
| Hide completely | The taskbar is hidden without reserving room for the dock |

Whatever you choose, the original taskbar comes back when OpenDock quits, crashes or is uninstalled. If it ever doesn't, see [Recovering the taskbar](installation.md#recovering-the-windows-taskbar).
