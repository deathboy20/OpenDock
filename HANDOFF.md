# HANDOFF

## Project

OpenDock: a local-first dock and taskbar replacement for Windows. Tauri 2 (Rust core) with a React 19 + TypeScript UI, in a pnpm monorepo:

- `apps/desktop`: the app. Rust in `src-tauri/src`, React in `src`.
- `apps/web`: the Astro website (opendock.pages.dev). Its widget list must match the app's catalog (`apps/web/src/data/product.test.ts`).
- `packages/config-schema`: Zod schemas, migrations and shared fixtures that the Rust tests also load.

Version 0.3.0 is the latest release; 0.4.0 is being prepared (see Current state). Canonical remote: `origin` = `github.com/deathboy20/OpenDock` (Isaac confirmed 2026-11-23). The README still links `isaacobenzy/OpenDock`; that mismatch is an open item.

## Current state

**Release 0.4.0 in preparation** (2026-11-23, Isaac asked for it). PR #11 merged into `main` as `3568f55`. Branch `release/0.4.0` was cut from `origin/main` (not from `develop` as `docs/releasing.md` describes, because the work went straight to `main`). It is local only: not pushed, no PR, no tag, no release build.
- `273171b` chore(release): versions 0.4.0 in all six places, `Cargo.lock` refreshed offline, CHANGELOG `## [0.4.0] - 2026-11-23` with a summary, website `releases.ts` and `docs/installation.md` point at 0.4.0 files. If the release ships on another day, change the date in both `CHANGELOG.md` and `apps/web/src/data/releases.ts` (a web test checks they match).
- `60f1bdc` desktop widget windows get read-only permissions (`settings-read`, `widget-read`, `apps-read`, `desktop-widget`).
- `3857a9a` dropped desktop widgets move off each other (`avoid_overlap` in `settings/desktop.rs`); privacy page list wording; `docs/UI_CHECKLIST.md`.
- Verified locally: lint, typecheck, tests (desktop 214, schema 130, web 13, Rust 107), fmt, clippy, `pnpm build:web` (11 pages), the release-script tests (18), and the release-notes script extracts the 0.4.0 section. In `pnpm dev`: desktop widgets load data and save drags under the new permissions. Website privacy and widgets pages have no overflow at 360 and 1280 px.
- **Release checklists.** Anti-slop: passes (`docs/ANTI_SLOP_CHECKLIST.md`). UI: ready after owner decision on three app-wide items, visible labels, pre-disabled buttons and 44 px targets in shared hub controls (`docs/UI_CHECKLIST.md`). Security: ready after owner action. Isaac accepted the known `pnpm audit` advisories (Astro, sharp, Zod) for 0.4.0 on 2026-11-23, with upgrades (Astro 7.4.7+, Zod 4.6.6+) planned for a later release; Dependabot alerts and secret scanning still need turning on in the GitHub settings. Details are in the vault (`Security/OpenDock security checklist 0.4.0 (2026-11-23).md`), not in this public repo.
- Not done (needs Isaac): push `release/0.4.0` and PR it, the manual Windows matrix on an installed build, the Release build dry run (`dry_run=true`, a cloud build), tagging `v0.4.0`, and publishing the draft.

- Branch `feat/developer-widgets`, cut from `origin/release/0.3.0` at `1fe5078` (Isaac chose this base on 2026-11-23). Pushed to `origin` on 2026-11-23 and opened as PR #11 into `main`: https://github.com/deathboy20/OpenDock/pull/11 (ready for review, not a draft). Before the push every local check passed again and `pnpm build:web` built 11 pages; `pnpm lighthouse:web` was not run. This HANDOFF update is committed locally but not pushed, to save a CI run; it goes up with the next push.
- Plan agreed with Isaac on 2026-11-23: `C:\Users\Obeng\Documents\AI-Vault\Plans\OpenDock developer widgets and skins.md`. Keep the Windows taskbar (with TranslucentTB) for now; build developer widgets (Phase A), then Rainmeter-style customisation (Phase B); taskbar mode (Phase C) only after A and B work and the restore matrix is recorded.

Done on this branch:

1. Settings version 6 in Rust (`src-tauri/src/settings/types.rs`) and Zod (`packages/config-schema/src/settings.ts`): `widgets.projects.roots`, `widgets.vault.path`, `widgets.localAi.model`, `widgets.ci.{enabled, repos}`. Migration 3/4/5 → 6 in both languages. Fixtures in `packages/config-schema/fixtures/settings.json`.
2. `net.rs`: `send()` with headers and JSON POST bodies; plain `http://` only for declared loopback hosts. Headers are never logged.
3. **Projects widget** (`id: projects`). Rust: `services/projects.rs` (scan two levels deep, `git status --porcelain=v2 --branch` with `core.fsmonitor=false`, HANDOFF.md reader capped at 512 KB), `commands/developer.rs` (`get_projects`, `refresh_projects`, `open_project`, `read_handoff`; actions accept only paths from the latest scan), `platform/process.rs` (no-console `git`, open a folder in Cursor, VS Code, Windows Terminal or PowerShell). GitHub Desktop opens via `x-github-client://openLocalRepo/`. UI: `features/developer/` (tile, panel, model, safe Markdown view) and the hub page **Developer widgets** (`features/hub/DeveloperPage.tsx`). The `Tile` helper moved to `features/widgets/Tile.tsx`.
4. **Vault capture widget** (`id: vault`). Rust `services/vault.rs`: appends `- HH:MM text` to `<vault>/Inbox/YYYY-MM-DD.md`, creates `Inbox` and the note on first use, refuses links and relative paths, 4000-character limit. Commands `get_vault_status`, `vault_capture`, `open_vault` (Obsidian `obsidian://open?path=`). UI `features/developer/VaultPanel.tsx`; vault path on the Developer widgets page.
5. **Local AI widget** (`id: local-ai`). Rust `services/local_ai.rs`: `/api/tags` and `/api/ps` on `http://127.0.0.1:11434` through `net.rs` (declared host `127.0.0.1`), polled every 60 s only while `local-ai` is in `dock.itemOrder`; `/api/generate` with `stream: false`, 180 s timeout, one prompt at a time, only to a model from the latest check, `<think>` blocks stripped. Commands `get_local_ai`, `refresh_local_ai`, `ask_local_ai`. The chosen model is `widgets.localAi.model`. UI `features/developer/LocalAiPanel.tsx`.
6. **CI status widget** (`id: ci`). Rust `services/ci.rs`: `GET https://api.github.com/repos/{repo}/actions/runs?per_page=1` through `net.rs` with `Accept` and `X-GitHub-Api-Version` headers and an optional `Bearer` token from the keychain (`secrets.rs`, account `github:token`). Polls every 5 min only when `widgets.ci.enabled`, repos are listed and `ci` is on the dock. Only `https://github.com/` run links are passed on or opened. Commands `get_ci_status`, `refresh_ci`, `open_ci_run`, and hub-only `set_github_token`, `clear_github_token`. UI `features/developer/CiPanel.tsx`; toggle, repos and token on the Developer widgets page.

Seen working in `pnpm dev` on 2026-11-23 (Windows 10 Pro, this PC, Windows taskbar kept): Projects listed 20 repos under `D:\Gitfiles` with branches and changes, expanded a row and showed OpenDock's HANDOFF.md; Vault capture wrote `- 14:20 OpenDock vault capture test (safe to delete)` to `AI-Vault/Inbox/2026-11-23.md`; Local AI listed both Ollama models and answered a prompt from `isaac-sec:latest`; CI status showed `deathboy20/OpenDock` as Passing; the Developer widgets hub page showed all three sections. Not clicked: the Cursor, VS Code, Terminal, GitHub Desktop and Files buttons, the Obsidian buttons, and saving a GitHub token.

Checks verified on 2026-11-23 (Windows 10 Pro, this PC): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm fmt:check`, `pnpm test:rust` and `cargo clippy --all-targets -- -D warnings` all pass. Rust builds offline from the local cargo cache.

Phase B (code complete; live check partly done, see below):

7. **Widget options** (settings v7, `widgets.options` keyed by widget id: `label` ≤ 40, `layout` auto/compact/detailed, `accent` theme/mint/sky/amber/rose/violet, `refreshSeconds` 15-3600 or null). The dock applies them in `features/dock/DockBar.tsx` (size, compact, `data-accent`, name); the flyout uses the label and accent. Rust `services::refresh_interval` applies the refresh with a floor per widget (Projects 30 s, Local AI 15 s, CI 60 s). Accent swatch tokens are in `styles/tokens.css`; `features/customise/widgetOptions.test.ts` measures their contrast. UI: hub page **Customise** (`features/customise/CustomisePage.tsx`), also linked from the dock menu.
8. **Skins** (`skins.active`, `skins.custom` ≤ 20). Token list `packages/config-schema/src/skin-tokens.json` and built-ins `builtin-skins.json` (Graphite, Paper, Dusk, Forest, High contrast), both read by Zod (`skins.ts`) and Rust (`settings/skins.rs`, `include_str!`). Values: colour (`#rrggbb[aa]` or `rgba()`), length/duration with a max, font and shadow presets. `app/App.tsx` sets the active skin's CSS variables on every window's root. Import (paste or `.json` file), export (copy JSON), delete and contrast warnings in `features/customise/SkinsSection.tsx`; `skinChecks.test.ts` measures the built-ins and checks the base colours match `tokens.css`.
9. **Scenes** (`scenes.items` ≤ 12, `scenes.active`). Rust `settings/scenes.rs` captures (`save_current`, replaces by name), applies (dock items, size, style, spacing, position, theme, skin, quiet hours, automations; never the taskbar mode; a missing skin falls back to none) and deletes. Commands `save_scene`, `apply_scene` (dock, flyout and hub via `dock-core`), `delete_scene` (hub only). Zod mirror `packages/config-schema/src/scenes.ts`. UI `features/customise/ScenesSection.tsx` and a Scenes list in the dock menu.
10. **Desktop widgets layer** (`desktop.grid` 8-64, `desktop.widgets` ≤ 12 of `{id, monitorId, x, y}`; positions are logical px relative to the monitor's top-left). Rust `settings/desktop.rs` (validation, `snap`, `settle`, `screen_position`; the first spot for a new widget comes from `nextFreeSpot` in `packages/config-schema/src/desktop.ts`) and `services/desktop.rs` (one `desk-<id>` window per widget: no decorations, transparent, `always_on_bottom`, skips the taskbar; synced at startup and whenever `settings.desktop` changes in `persist_settings`). The window starts a native drag after 4 px of movement, then calls `settle_desktop_widget`, which snaps, clamps to the monitor and saves the monitor name. Capability `capabilities/desktop.json` (`desk-*`). UI `features/desktop/DesktopWidgetApp.tsx` and `features/customise/DesktopSection.tsx`. No Win32 code was needed: Tauri's `always_on_bottom` covers it.

11. **App icon fix**: the Rust (`services/apps.rs`) and UI (`services/appIcons.ts`) icon caches no longer keep a failed lookup forever; misses are retried after 20 s (UI up to 4 times). This was the "F" and "M" letters Isaac saw for File Explorer and Edge.

12. **Skin interfaces** (Isaac's request after seeing lumabar.xyz/widgets and /showcase and Rainmeter). `dock.layout` (bar/islands/chips), `dock.density` (regular/slim; Rust `geometry::cross_axis_thickness` takes it), `dock.tint` (soft/medium/strong), `widgets.options[id].variant` validated against `packages/config-schema/src/widget-variants.json` (Rust `settings/variants.rs`), and an optional strict `interface` section on skins that `settings::skins::apply` copies into settings (command `apply_skin`). Tiles draw the variants (`Dots`, `Gauge`, `AnalogClock` in `features/widgets/visuals.tsx`); `tiles.test.tsx` renders every variant in every state and size. Five more built-ins: Islands, Daylight, Console, Instruments, Float. UI: Interface section with a preview over sample wallpapers (`--od-preview-*` tokens), and a Look picker per widget. Also adds `updates.check` (default on) for the update check that follows.

13. **Update checks** ([ADR 0006](docs/adr/0006-update-checks.md), status Proposed). Rust `services/updates.rs`: `GET https://api.github.com/repos/deathboy20/OpenDock/releases/latest` through `net.rs` (ledger name `updates`), once a day and 90 s after start while `updates.check` is on (default on), or on `check_for_updates`. Semver compare with pre-releases older than their release; only `github.com/deathboy20/OpenDock/releases/` links are opened (`open_update_page`). UI: **Download OpenDock x.y.z** in the dock menu and an Updates section in Dock settings. Installing is still manual.

14. **Undo, reset and first-run look**: switching skins offers Undo, which restores only the look (`features/customise/look.ts`, `restoreLook`); each widget's options have Reset; the welcome flow's Make it yours step offers Islands, Daylight, Float, Graphite and High contrast (`features/hub/WelcomePage.tsx`, applied with `apply_skin`).
15. **Islands drawn as one capsule per run** (`measureIslands` and `useIslandRects` in `features/dock/islands.ts`, `.dock-islands` in `dock.css`), and the **toast** built with `.focusable(false)` and shown with Tauri's `show()` (no more raw `ShowWindow`).
16. **Anti-slop checklist** for the branch: `docs/ANTI_SLOP_CHECKLIST.md` (20 checks pass or N/A, with evidence).

Isaac gave full access on 2026-11-23 to build skins and improvements beyond the plan, using the anti-slop skills; items 12-16 come from that.

Live checks in `pnpm dev`, 2026-11-23, second run (Islands skin, islands layout, slim, strong tint, analog clock and System bars written into the dev settings; v5 settings restored afterwards): the real dock showed the islands, slim bar, analog clock and System bars; after the capsule fix the islands are seamless; the title-bar toast did not come back after the toast fix; the two desktop widgets were dragged (by Isaac) and saved snapped to the 16 px grid with `\\.\DISPLAY1`; the Customise page (Interface preview on all three sample wallpapers, Look picker for the clock, skins) was checked in the browser preview at `http://localhost:1420/?window=hub&page=customise`, which has no Rust backend, so widgets there show "unavailable".

Phase B live check, 2026-11-23 in `pnpm dev` (taskbar kept, v5 settings backed up and restored afterwards):
- Seen: the two desktop widgets (Clock, Projects) open at their saved spots on the desktop; after the icon fix, File Explorer and Edge show real icons; the Customise page with Scenes, Skins and the five skin cards; Dusk, High contrast and Paper applied in the browser preview (`http://localhost:1420/?window=hub&page=customise`, in-memory settings).
- Not verified: dragging and snapping a desktop widget, a second monitor, saving or switching a scene, importing or exporting a skin, and skins on the real dock. Isaac declined click access to Explorer, which sat in front of the dock, so the real app couldn't be clicked.

## Open items and known issues

- One settings bump covers each phase: v6 for all four developer widgets, v7 for all of Phase B. Neither has shipped, and each field defaults, so files written by an earlier commit on this branch still load. Decision by the agent; say if you want one bump per feature.
- Project folders default to an empty list, not `D:\Gitfiles`, because the default ships to every user. Isaac adds `D:\Gitfiles` once in **Developer widgets**.
- Skin interfaces seen on the real dock on 2026-11-23: islands, slim, strong tint, analog clock and System bars. Islands are drawn as one measured capsule per run (`measureIslands` in `features/dock/islands.ts`) after per-item slices showed seams. Not yet seen: a vertical dock with islands, chips on the real dock, and every widget look on screen (all are covered by tests).
- **In-app install of updates is not built.** Update *checks* are (item 13). Installing in the app needs `tauri-plugin-updater` (new crate and npm package), an update signing key kept as a GitHub secret, and a signed `latest.json` published with each release. It's on the 1.0 roadmap and needs Isaac's OK for the key and the CI change.
- **Linux and macOS** have build-only experimental packages (see `ROADMAP.md`); nothing runs or is tested there. The new code has non-Windows fallbacks (`platform/process.rs`, keychain via `keyring`, Tauri `always_on_bottom`), but desktop widgets can't place themselves on Wayland and the taskbar features are Windows-only.
- The toast window (`OpenDock notification`) appeared once with a native title bar after a dev rebuild. Likely cause: it is shown with a raw no-activate `ShowWindow`, which skips the window library's show step. The first fix (re-applying `set_decorations(false)`) did not help: tao keeps the caption style and hides the frame only through its own show path. Now the toast is built with `.focusable(false)` (`WS_EX_NOACTIVATE`) and shown with Tauri's `show()`, and the raw `show_without_focus` / `show_no_activate` helpers are gone. After the change the title-bar toast no longer appeared on restart in `pnpm dev`; it was intermittent before, so keep an eye on it.
- An untracked `INVENTORY-AND-PLAN.md` (a workstation inventory with personal paths, from another session) sits in the repo root. It is not part of OpenDock; never commit it. Move it to the vault.
- README links `isaacobenzy/OpenDock` while the canonical remote is `deathboy20/OpenDock`. Not changed.
- Running `pnpm dev` on this PC uses the installed app's `%APPDATA%\com.opendock.app\settings.json`, which has taskbar mode `replace` and start-with-Windows on. A dev run hides the taskbar and migrates the file to v6, which the installed 0.3.0 would then reject. Back it up first. The 2026-11-23 run used `settings.v5-backup-2026-11-23.json` and `opendock.db.backup-2026-11-23` (same folder); the original v5 settings were copied back afterwards.
- Projects never fetches, so "behind" is relative to the last fetch. Each `git status` has a 10 s limit; a repo that takes longer shows "git status took too long".
- Local `main` is behind `origin/release/0.3.0` by the two CI release fixes.

## How to work here

- Install: `pnpm install --offline` (no new downloads without Isaac's OK; no new crate or npm package without his OK).
- Run: `pnpm dev` (Tauri dev: Vite on port 1420 plus the Rust app).
- Checks before every commit:

  ```powershell
  pnpm lint; pnpm typecheck; pnpm test; pnpm fmt:check; pnpm test:rust
  cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
  ```

- Engineering rules: `AGENTS.md` (React presents, Rust decides; one schema in two languages with shared fixtures; settings bumps with migrations in both; all HTTP through `net.rs`; Win32 only in `platform/`; widgets complete at `s`/`m`/`l` with loading, empty and error states in `tiles.test.tsx`; tokens only; new commands on the `build.rs` allow-list and in `permissions/opendock.toml`).
- Key files: widget catalog `apps/desktop/src/features/widgets/catalog.ts`; tiles `features/widgets/tiles.tsx`; panels `features/flyout/FlyoutApp.tsx`; live data `services/live.tsx`; IPC `services/ipc.ts`; commands registered in `src-tauri/src/lib.rs`.
- Git: Conventional Commits. No AI attribution anywhere (no `Co-Authored-By`, no "Generated with" lines, no AI author). No push, PR or cloud build unless Isaac asks. CI runs only on PRs into `main`.

## Next steps

0. Release 0.4.0: Isaac turns on Dependabot alerts and secret scanning and decides on the three UI checklist items, then push `release/0.4.0`, PR it, dry-run the Release build, tag `v0.4.0`, review and publish the draft (`docs/releasing.md`).
1. Isaac to look at the dock in `pnpm dev` (back up `settings.json` first; see Open items) and try Customise on the real app: skins, Undo, islands and chips, a vertical dock, widget looks, scenes, desktop widgets.
2. Decide: (a) ADR 0006 (update checks on by default) from Proposed to Accepted, (b) `tauri-plugin-updater` with a signing key for in-app installs, (c) review and merge PR #11 (targets `main`; the README's flow would send features to `develop` first). Before merging to `main`, run the `security-release-checklist` and `ui-release-checklist` skills; neither has run yet.
3. Upgrade Astro (7.4.7+) and Zod (4.6.6+) after 0.4.0, as agreed when the advisories were accepted.
4. Worth doing next: a "switch scene" automation action (scenes from rules, e.g. Focus at 9:00), more widget looks (Now playing bar with progress, Year progress dots), and a Linux/macOS runtime check before promising those platforms.
5. Phase C (taskbar mode) waits for Isaac and a recorded `docs/testing-matrix.md` on Windows 10.

Last updated: 2026-11-23
