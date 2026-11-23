# Anti-slop checklist: `feat/developer-widgets`

Run on 2026-11-23 against the whole branch (base `1fe5078`): developer widgets, Customise (scenes, skins, interface, widget looks, desktop widgets), update checks and fixes. Judged against OpenDock's own system: tokens in `apps/desktop/src/styles/tokens.css`, one accent per theme, Inter / Segoe UI Variable, radius tokens 10/14/20/26 px, motion tokens 140/260 ms with one ease, and the glass pill dock as the signature.

Code scans ran on the diff's added lines (6,561): no new hex values outside `tokens.css`, no `any` or `@ts-ignore`, no `TODO`, `FIXME`, `console.log`, `dbg!` or `println!`, no emoji, no buzzwords, and no em dashes in UI strings.

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Default AI palette | Pass | New colours live only in `tokens.css` (accent swatches, preview wallpapers) and in skins, which are optional. The default look is unchanged. |
| 2 | Gradient text, glass everywhere, glow | Pass | No gradient text. Glass is the dock's existing treatment, reused for islands. Gradients exist only as the three labelled sample wallpapers in the Customise preview. |
| 3 | Template feature grid | Pass | Settings are rows and lists; the only card grids are choice sets (skins, widget looks) where each card is a live preview. |
| 4 | Everything centred | Pass | Body copy and lists are left-aligned; only preview docks are centred, as the real dock is. |
| 5 | Emoji and sparkles as UI | Pass | None added. New icons (`folder`, `branch`, `terminal`, `code`, `inbox`, `chip`, `pipeline`, `palette`, `back`) use the existing 24 px, 1.8 px stroke set. HANDOFF checkboxes are drawn boxes, not glyphs. No brand logos redrawn: tools are named in text. |
| 6 | One radius, shadows on everything, cards in cards | Pass | Radius tokens throughout; cards use borders. Island capsules use the tile radius rule already used by dock items. |
| 7 | Fake or stock visuals | Pass | Previews render the real tiles. The sample wallpapers are abstract gradients labelled "Preview wallpaper" and never shown behind real UI. |
| 8 | No type or space system | Pass, note | Fonts come from the token stacks; skins may pick only `default`, `segoe`, `system` or `mono` (a "rounded" option was removed because OpenDock doesn't ship that font). Some feature CSS uses px sizes such as 11.5 and 12.5 px, matching the existing dock and flyout CSS. |
| 9 | Buzzword stack | Pass | Scan found none. |
| 10 | Model tics | Pass | No em dashes in new UI strings; copy is short sentences. |
| 11 | Generic hero and buttons | Pass | Buttons name the action: "Save to Inbox", "Save current setup", "Download OpenDock 0.4.0", "Check again", "Open in Obsidian", "Reset Clock". |
| 12 | Fake social proof | N/A | No marketing content added. |
| 13 | Placeholder and case drift | Pass | Sentence case throughout. Example inputs are marked as examples (`owner/name`, `D:\Gitfiles`, `github_pat_…`). |
| 14 | Motion as wallpaper | Pass | No new animations. Only state transitions on rings, gauges and rows using `--od-fast` / `--od-slow`. |
| 15 | Uncontrolled motion | Pass | Nothing loops. The global reduced-motion rule in `tokens.css` covers the new transitions, and the new CSS adds explicit `prefers-reduced-motion` blocks where it animates. |
| 16 | Dead UI | Pass | Removed code that the changes made unused: Rust `next_free_spot`, `show_without_focus` / `show_no_activate`, the per-item island CSS. Clippy `-D warnings` passes. |
| 17 | Loose types | Pass | IPC types are declared in `services/ipc.ts`; settings are Zod-parsed and Rust-validated with shared fixtures. |
| 18 | Duplicated utilities | Pass, note | Shared helpers are reused (`plural`, `encode_component`, `contrastRatio`, `islandEdges`). One small duplicate: `env_path` exists in both `platform/win_apps.rs` and `platform/process.rs` (both private, three lines). |
| 19 | Unused or demo deps | Pass | No dependencies added; everything built offline from the existing lockfiles. |
| 20 | Unfinished ship path | Pass | No TODOs or debug output. Test data lives in tests and fixtures only. |

**Could this belong to any other brand?** The islands layout takes its structure from setups people share for lumabar and from Rainmeter suites, but it is drawn with OpenDock's own tokens, glass treatment and tile shapes, and no third-party artwork, names or colours were copied.

**Not covered here:** the release gates `security-release-checklist` and `ui-release-checklist` must run before this branch merges to `main`; neither has been run.
