# 0006. Check for updates without an updater service

- **Status:** Proposed
- **Date:** 2026-11-23

## Context

People install OpenDock from a GitHub release and have no way to learn that a newer one exists. Isaac asked for users to get updates. [ADR 0005](0005-local-first-no-telemetry.md) rules out accounts, telemetry and remote configuration, and every request must be declared and shown in the Privacy Ledger.

Options considered:

1. **No checks.** Users find releases themselves. Private, but most people stay on old versions with old bugs.
2. **Tauri's updater plugin.** Downloads, verifies and installs a signed update in the app. Needs a new crate and npm package, an update signing key kept as a CI secret, and a signed `latest.json` published with every release.
3. **A daily version check.** Ask GitHub for the latest release, compare versions, and send the user to the release page to download the installer.

## Decision

We will ship option 3 now. Once a day, about 90 seconds after start-up, OpenDock calls `GET https://api.github.com/repos/deathboy20/OpenDock/releases/latest` through `net.rs`. The request carries no identifiers beyond OpenDock's user agent and version, and shows in the Privacy Ledger as `updates`. Drafts and pre-releases are ignored. Only release links on `github.com/deathboy20/OpenDock/releases/` are opened. The check is on by default, can be turned off in Dock settings, and **Check now** runs it on demand.

Option 2 stays the goal for 1.0 and needs its own decision on the signing key and release pipeline.

## Consequences

- Users see a **Download OpenDock x.y.z** item in the dock menu and a notice in Dock settings when a newer release exists.
- GitHub sees one anonymous request per day per running copy; that's the only network call OpenDock makes without a widget asking for it. The Privacy page and `docs/security.md` say so.
- Installing is still manual: the user downloads and runs the new installer.
- Moving the repository means changing `REPO` in `services/updates.rs` in the same release.
