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

Verified on 2026-11-23 (Windows 10 Pro, this PC): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm fmt:check`, `pnpm test:rust` and `cargo clippy --all-targets -- -D warnings` all pass. Rust builds offline from the local cargo cache.

## Open items and known issues

- One settings bump (v6) covers all four developer widgets instead of one bump per widget: v6 has not shipped, and each field defaults, so files written by an earlier commit on this branch still load. Decision by the agent; say if you want one bump per widget.
- Project folders default to an empty list, not `D:\Gitfiles`, because the default ships to every user. Isaac adds `D:\Gitfiles` once in **Developer widgets**.
- README links `isaacobenzy/OpenDock` while the canonical remote is `deathboy20/OpenDock`. Not changed.
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

1. Phase A widgets, one commit each: Projects, Vault capture, Local AI (Ollama), CI status (opt-in, token in the keychain).
2. Show them in `pnpm dev`, then Phase B: per-widget instance options, JSON skins (token overrides only), desktop widgets layer, Scenes.
3. Phase C (taskbar mode) waits for Isaac and a recorded `docs/testing-matrix.md` on Windows 10.

Last updated: 2026-11-23
