# Linux experimental builds and package verification

Linux x64 and arm64 packages are experimental build-only artifacts. Passing compilation, packaging or install smoke checks does not prove graphical runtime behavior. Windows taskbar replacement, window previews and screen-edge reservation are not available on Linux.

## Build

Use a native Linux environment with Node 22, the pnpm version in package.json, and Rust stable. The package workflow uses Ubuntu 22.04 as the compatibility baseline, rather than cross-compiling GTK/WebKitGTK from Windows.

```sh
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libfuse2 rpm
pnpm install --frozen-lockfile
pnpm --filter @opendock/desktop tauri build --bundles deb,rpm,appimage -- --locked
node scripts/collect-packages.mjs linux-x64
```

The collector requires a fresh release/linux-x64 directory, exactly one current-version package of each format, and writes SHA256SUMS-linux-x64.txt. It refuses partial or ambiguous output. Build directories from earlier runs must not be reused as release evidence.

The release workflow builds Linux packages as part of a cross-platform draft GitHub release. A manual dispatch with `dry_run=true` builds artifacts without publishing a release. The install smoke test checks package installation, installed files and dynamic-library resolution only; it does not test the UI or desktop-session behavior. Debian listings are read with `dpkg -L` after install so missing `./` prefixes in `dpkg-deb --contents` cannot hide the binary. Fedora images install the `file` package before inspecting the RPM.

## Distribution acceptance

DEB targets compatible Debian/Ubuntu installations; RPM targets compatible Fedora-family installations; AppImage targets compatible glibc systems. These formats do not guarantee support for every distro. Record the exact OS version, architecture, desktop environment, display server, WebKitGTK and glibc versions in the release results.

For any future runtime-support claim, verify checksums, install, launch, single-instance behaviour, settings persistence, app launching, keychain persistence, offline behaviour, upgrade and uninstall on each advertised distro. Test X11 and Wayland independently. Do not disable WebKit's sandbox to make a smoke test pass.

```sh
sha256sum -c SHA256SUMS.txt
dpkg-deb --info OpenDock_*.deb
rpm -qip OpenDock-*.rpm
rpm -qp --requires OpenDock-*.rpm
```

The release's combined `SHA256SUMS.txt` is the published checksum file. Per-platform checksum files are also kept with workflow artifacts. Record graphical session and installed-build results separately from package installability checks. Linux has no recorded runtime acceptance results.

Flatpak manifest and `flatpak-builder` CI are a TODO. Do not publish a Flatpak or claim Flatpak support until that path builds and is tested cleanly.

## References

- [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/)
- [AppImage compatibility baseline](https://v2.tauri.app/distribute/appimage/)
- [Debian packaging](https://v2.tauri.app/distribute/debian/)
- [RPM packaging](https://v2.tauri.app/distribute/rpm/)
