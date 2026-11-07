# Installing OpenDock

## System requirements

- Windows 10 or Windows 11, 64-bit, with Microsoft Edge WebView2 runtime (preinstalled on Windows 11; the installer fetches it on Windows 10 if it's missing)
- Linux and macOS packages are experimental build-only artifacts. Build and package checks do not establish graphical runtime behavior or feature support.

## Platform status

Windows is the only supported platform. Linux x64/arm64 and universal macOS downloads are experimental. Do not expect Windows taskbar replacement, live window previews or screen-edge reservation on Linux or macOS.

## Download

Get the latest version from [GitHub Releases](https://github.com/isaacobenzy/OpenDock/releases/latest). Each release has:

| File | Use it when |
| --- | --- |
| `OpenDock_<version>_x64-setup.exe` | You're installing for yourself. Recommended. |
| `OpenDock_<version>_x64_en-US.msi` | You deploy software with Group Policy, Intune or another management tool |
| `.AppImage`, `.deb`, `.rpm`, or `.dmg` | Experimental Linux or macOS build-only artifact |
| `SHA256SUMS.txt` | Verify every release download |

### Verify the download

In PowerShell, in your Downloads folder:

```powershell
Get-FileHash .\OpenDock_0.2.0_x64-setup.exe -Algorithm SHA256
```

The hash must match the line for that file in `SHA256SUMS.txt` (letter case doesn't matter).

On Linux or macOS, download all release assets into one directory and run:

```sh
sha256sum -c SHA256SUMS.txt
```

## Install

1. Run the installer.
2. Pre-1.0 builds aren't code-signed yet, so Windows SmartScreen may show *Windows protected your PC*. If the checksum matched, choose **More info**, then **Run anyway**.
3. When OpenDock starts for the first time, the welcome setup asks three things:
   - **Taskbar:** *Replace the taskbar* (recommended), *Auto-hide* or *Keep the taskbar*.
   - **Your apps:** which of your current taskbar pins to bring over.
   - **Look and feel:** style, theme, and whether to start with Windows.

You can change all of these later from the dock menu (right-click an empty part of the dock) or the hub.

## Linux (experimental build only)

These steps install the package; they do not establish that the graphical application works on a particular distribution or desktop session.

- AppImage: `chmod +x ./OpenDock_*.AppImage`, then run `./OpenDock_*.AppImage`.
- Debian, Ubuntu or Mint: `sudo apt install ./OpenDock_*.deb`.
- Fedora, RHEL or openSUSE: `sudo dnf install ./OpenDock-*.rpm` (use the distribution's package manager if it does not provide `dnf`).

Flatpak packaging is not included because it has not been validated in CI. Linux runtime acceptance remains unrecorded.

## macOS (experimental build only)

Open the DMG and move OpenDock to Applications. Unsigned, unnotarized builds may be blocked by Gatekeeper. Try Control-click or right-click OpenDock and choose **Open**. If needed, remove the quarantine attribute explicitly:

```sh
xattr -dr com.apple.quarantine /Applications/OpenDock.app
```

This build-only status does not establish that the UI or macOS-specific behavior works.

## Update

Install the newer version over the existing one. Your settings, pins, todos, notes, rules and calendars are kept. An automatic updater is planned for 1.0.

## Uninstall

Use **Settings → Apps → Installed apps → OpenDock → Uninstall**. The uninstaller:

1. Restores the Windows taskbar to how it was before OpenDock changed it.
2. Removes OpenDock from startup.
3. Removes the program files.

Your data stays in `%APPDATA%\com.opendock.app` in case you reinstall. To remove it too, delete that folder, and delete any `OpenDock` entries in **Credential Manager → Windows Credentials**.

## Recovering the Windows taskbar

OpenDock restores the taskbar when it quits, when it crashes (a small guard process watches for that), before it signs out, restarts or shuts down the PC from the launcher, and when it's uninstalled. If Windows ends OpenDock some other way, for example a sign-out from the Windows menu, OpenDock repairs the taskbar the next time it starts.

If the taskbar is still hidden, try these in order:

1. **Restore it from OpenDock:** right-click the dock and choose **Restore the Windows taskbar**, or use the same button in the quick-actions tray. Then choose **Quit OpenDock** if you want the app to exit.
2. **Run the restore command:** press `Win+R` and run:

   ```
   "%LOCALAPPDATA%\OpenDock\opendock-desktop.exe" --restore-taskbar
   ```

   Adjust the path if you installed somewhere else.
3. **Turn off auto-hide in Windows:** open **Settings → Personalization → Taskbar → Taskbar behaviors** and clear **Automatically hide the taskbar**.
4. **Restart Windows Explorer:** open Task Manager (`Ctrl+Shift+Esc`), find **Windows Explorer**, and choose **Restart**.

If none of these work, please [open a bug report](https://github.com/isaacobenzy/OpenDock/issues/new?template=bug_report.yml) with your Windows version.

## Build from source

See [development.md](development.md).
