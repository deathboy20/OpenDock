# UI release checklist: 0.4.0

Run on 2026-11-23 on `release/0.4.0`, for what 0.4.0 changes: the developer widget panels, the Customise page (scenes, skins, interface, widget options and looks, desktop widgets), the dock's islands and chips, Dock settings → Updates, first-run Look, and two website pages (privacy, widgets).

**System card.** Palette: neutral surfaces with one accent per theme, info/warn/danger always paired with words. Type: Inter → Segoe UI Variable, 12–15 px UI scale, tabular numbers for values. Shape: radius tokens 10/14/20/26 px, pill dock, round icon wells. Motion: `--od-fast` 140 ms and `--od-slow` 260 ms with one ease; global reduced-motion rule. Signature: the glass pill dock, split into capsules by the islands layout.

**How it was checked:** the dock, panels and desktop widgets in `pnpm dev` on Windows 10 (screenshots); the hub's Customise page in the browser preview at 1280 px with measured control sizes; the built website served locally at 360 px and 1280 px; contrast measured in tests (`skinChecks.test.ts`, `widgetOptions.test.ts`); every widget look rendered in every state and size in `tiles.test.tsx`.

**Verdict: ready after owner decision.** Three items (14, 15, 19) fall short of Isaac's rules in shared hub components that 0.4.0 reuses. They are the same in 0.3.0, and fixing them means reworking those components across the app. Isaac decides whether they block 0.4.0 or go in a follow-up.

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | No overflow | Pass | Website privacy and widgets pages: `scrollWidth` equals the viewport at 360 px and 1280 px. Hub min width 860 px; panels fixed at 360/420 px with ellipsis on long names, branches and paths. |
| 2 | Zoom and reflow | Pass | Website viewport `width=device-width, initial-scale=1`; zoom not disabled. |
| 3 | Safe areas | N/A | Desktop windows; website has no fixed bottom UI. |
| 4 | Reserved space, long content | Pass | Tiles, island capsules and previews have fixed sizes; long repo, branch, model and skin names truncate with ellipsis and full text in `title`. |
| 5 | Type scale | Pass | Token font stacks; skins may only pick listed fonts. One `h1` per website page. |
| 6 | Mobile input size | N/A | Desktop app; website changes add no inputs. |
| 7 | Numbers and locale | Pass | Tabular numbers for times, counts and percentages; dates via the existing formatters. |
| 8 | Text contrast | Pass | Measured in tests: all ten built-in skins keep text and secondary text ≥ 4.5:1 on panels in both themes; accent swatch ink ≥ 4.5:1. |
| 9 | Non-text contrast | Pass | Accent against panels ≥ 3:1 for swatches and built-in skins (tests); focus ring is a 2 px accent outline. |
| 10 | Colour not the only cue | Pass | CI states, project status, update status and contrast warnings all say it in words; status dots are decorative. |
| 11 | All states | Pass | Every new panel has loading, empty and error states; tiles covered in `tiles.test.tsx` for every size, state and look. |
| 12 | Loading without flicker | Pass | Skeletons sized like the final tile; loading buttons keep their label with an ellipsis ("Saving…", "Thinking…", "Checking…"). |
| 13 | Errors and exits | Pass | Errors say what to do ("Install Git for Windows, then check again"). Skin switching has Undo; widget options have Reset; scenes and skins can be deleted. |
| 14 | Visible labels | **Owner** | New option fields have visible labels. Several single-field rows (folder path, repository, vault path, scene name, skin import) use the section heading and an `aria-label` rather than a visible `<label>`, matching existing hub inputs such as the city search. |
| 15 | Validation | **Owner** | Add and Save buttons are disabled while their field is empty, a pattern used across the existing hub and panels. Invalid repository names show an error next to the field. |
| 16 | Input behaviour | Pass | Token field is `type="password"` with `autoComplete="off"`; paste is never blocked. |
| 17 | Keyboard and focus | Pass | Native buttons and inputs throughout; global `:focus-visible` ring in `base.css` plus explicit rings on new cards, rows and swatches. Choice groups use one tab stop per option (existing pattern), not arrow keys. |
| 18 | Semantics | Pass | Icon-only buttons have `aria-label`; previews and decorative visuals are `aria-hidden`; gauges, dots, rings and the analog clock carry `role="img"` with a spoken label. |
| 19 | Targets ≥ 44 px | **Owner** | New controls: option rows 44 px, skin and look cards ≥ 96 px, swatches 32 px. Shared hub controls reused here are smaller: segmented choices 26 px, buttons and inputs 32 px, switches 20 px tall (36 px wide). Pointer-first desktop UI, unchanged from 0.3.0; raising them is an app-wide change. |
| 20 | Cheap properties | Pass | No `transition: all`; new transitions use token durations (rings and gauges animate stroke offset, rows animate background colour). |
| 21 | Reduced motion | Pass | Global rule in `tokens.css` plus explicit blocks in the new CSS. |
| 22 | Pause and flash | N/A | Nothing loops or flashes. |
| 23 | Core Web Vitals | Not run | Website changes are text-only in two existing pages; `pnpm lighthouse:web` was not run. |
| 24 | Media and fonts | N/A | No new media or fonts. |
| 25 | Safe area and keyboard (Expo) | N/A | Not a mobile app. |
| 26 | Pressed, not hover-only | Pass | Pressed states on new buttons; nothing is reachable only by hover (project actions open on click). |
| 27 | Dynamic Type | N/A | Not a mobile app; text scales with Windows display scaling. |
| 28 | Real content | Pass | Real widget data; sample wallpapers are labelled as previews. |
| 29 | Specific actions and titles | Pass | "Save to Inbox", "Save current setup", "Download OpenDock 0.4.0", "Check now", "Reset Clock"; hub and panel titles match the view. |
| 30 | One signature move | Pass | The pill dock and its islands; everything else uses existing tokens and components. See `docs/ANTI_SLOP_CHECKLIST.md`. |
