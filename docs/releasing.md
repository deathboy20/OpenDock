# Releasing

This is the checklist maintainers follow to ship a version. OpenDock uses [Semantic Versioning](https://semver.org); before 1.0, minor versions may include breaking changes, and those are called out in the changelog.

## Versions live in six places

Bump all of them in the release branch:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `apps/desktop/package.json` | `version` |
| `apps/web/package.json` | `version` |
| `packages/config-schema/package.json` | `version` |
| `apps/desktop/src-tauri/Cargo.toml` | `version`, then run `cargo update -p opendock-desktop --offline` to refresh `Cargo.lock` |
| `apps/desktop/src-tauri/tauri.conf.json` | `version`. This is the one the installers use |

Also update the website's release data in `apps/web/src/data/releases.ts`, so the download page links the new files.

## 1. Prepare the release branch

```powershell
git switch develop
git pull
git switch -c release/0.3.0
```

- Bump the versions listed above.
- In `CHANGELOG.md`, move the *Unreleased* entries under a new heading `## [0.3.0] - YYYY-MM-DD` and update the comparison links at the bottom.
- Open a pull request from `release/0.3.0` into `staging`. Only fixes for problems found during the release go into this branch from now on.
- When `staging` is the candidate you want to ship, open a pull request from `staging` into `main`.

## 2. Verify

All CI checks must pass on the pull request. Then build the installers locally and run the [manual Windows matrix](testing.md#manual-windows-matrix) against the **installed** build:

```powershell
pnpm install --frozen-lockfile
pnpm lint; pnpm typecheck; pnpm test; pnpm test:rust
pnpm bundle:desktop
./scripts/collect-release.ps1 -OutDir release
```

`release/` then contains:

- `OpenDock_<version>_x64-setup.exe`
- `OpenDock_<version>_x64_en-US.msi`
- `SHA256SUMS.txt`

Record the results of the matrix, and the Windows versions you tested on, in the pull request.

## 3. Promote, dry-run, and tag

1. Merge the version-bump PR into `develop`, then promote `develop` to `staging` and `staging` to `main` through pull requests. Wait for required checks at each stage.
2. Dispatch the **Release build** workflow on `main` with `dry_run=true`. Confirm all platform builds, package inspections, checksums and install smoke jobs pass. The dry run builds artifacts and a `opendock-release-notes` preview but publishes nothing.
3. Only after the dry run is green, tag the current `main` commit and push that tag:

   ```sh
   git switch main
   git pull --ff-only
   git tag -a v0.3.0 -m "OpenDock 0.3.0"
   git push origin v0.3.0
   ```

   The tag workflow verifies the version fields, changelog section and tag ancestry before building. It creates a draft GitHub release titled `OpenDock <version>` with the combined artifacts, `SHA256SUMS.txt`, and notes taken from that version's changelog section plus platform support. Stable versions are not marked as pre-release; publishing the draft makes it the Latest release. Versions with a suffix such as `-beta.1` stay pre-releases. If a tag already exists or a guard fails, stop and resolve it; do not overwrite a release.
4. Open promotion PRs from `main` back into `staging` and `develop` so the version bump and release fixes stay synchronized.

## 4. Review and publish

1. Download the packages from the generated draft, check `SHA256SUMS.txt`, and test the installed Windows build and every advertised Linux distro/session. See [Linux acceptance](linux.md). Package compilation alone does not establish Linux shell support.
2. Open the draft on the GitHub Releases page, check the title, notes, and attached installers, then publish it. For a pre-release version (`-beta.1` and so on), keep it marked as a pre-release so it does not replace Latest.

## 5. Announce

- Make sure the website deployed and that the download page points at the new version (see [website.md](website.md)).
- Close the milestone and move any open issues to the next one.
- Post a short announcement in GitHub Discussions.

## Hotfixes

For an urgent fix to the released version:

1. Branch from the tag: `git switch -c hotfix/0.3.1 v0.3.0`.
2. Fix the bug, add a test, and bump the patch version.
3. Follow steps 2 to 5, with the pull request going into `main`, then merge `main` back into `staging` and `develop`.

## Code signing

Installers aren't code-signed yet, so Windows SmartScreen warns users on first run. Signing is planned before 1.0. When it's added, the certificate will live only in GitHub Actions secrets and will be used only by the release workflow; it must never be committed or stored on a contributor's machine.
