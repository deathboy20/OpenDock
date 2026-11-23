# HANDOFF

## Project

OpenDock: a local-first dock and taskbar replacement for Windows. Tauri 2 (Rust core) with a React 19 + TypeScript UI, in a pnpm monorepo:

- `apps/desktop`: the app. Rust in `src-tauri/src`, React in `src`.
- `apps/web`: the Astro website (opendock.pages.dev). Its widget list must match the app's catalog (`apps/web/src/data/product.test.ts`).
- `packages/config-schema`: Zod schemas, migrations and shared fixtures that the Rust tests also load.

Version 0.3.0 is released. Canonical remote: `origin` = `github.com/deathboy20/OpenDock` (Isaac confirmed 2026-11-23). The README still links `isaacobenzy/OpenDock`; that mismatch is an open item.

## Current state

- Branch `feat/developer-widgets`, cut from `origin/release/0.3.0` at `1fe5078` (Isaac chose this base on 2026-11-23). Not pushed. No PR.
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

Phase B, in progress:

7. **Widget options** (settings v7, `widgets.options` keyed by widget id: `label` ≤ 40, `layout` auto/compact/detailed, `accent` theme/mint/sky/amber/rose/violet, `refreshSeconds` 15-3600 or null). The dock applies them in `features/dock/DockBar.tsx` (size, compact, `data-accent`, name); the flyout uses the label and accent. Rust `services::refresh_interval` applies the refresh with a floor per widget (Projects 30 s, Local AI 15 s, CI 60 s). Accent swatch tokens are in `styles/tokens.css`; `features/customise/widgetOptions.test.ts` measures their contrast. UI: hub page **Customise** (`features/customise/CustomisePage.tsx`), also linked from the dock menu.

## Open items and known issues

- One settings bump covers each phase: v6 for all four developer widgets, v7 for all of Phase B. Neither has shipped, and each field defaults, so files written by an earlier commit on this branch still load. Decision by the agent; say if you want one bump per feature.
- Project folders default to an empty list, not `D:\Gitfiles`, because the default ships to every user. Isaac adds `D:\Gitfiles` once in **Developer widgets**.
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

1. Phase A code is complete: Local AI (Ollama), CI status (opt-in, token in the keychain).
2. Phase B: per-widget instance options, JSON skins (token overrides only), desktop widgets layer, Scenes.
3. Phase C (taskbar mode) waits for Isaac and a recorded `docs/testing-matrix.md` on Windows 10.

Last updated: 2026-11-23
