import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findDesktopFile, findInstalledBinary, listingPath } from './package-paths.mjs';

const debianContents = `drwxr-xr-x 0/0               0 2026-11-07 21:23 usr
drwxr-xr-x 0/0               0 2026-11-07 21:23 usr/bin
-rwxr-xr-x 0/0        13685464 2026-11-07 21:23 usr/bin/opendock-desktop
drwxr-xr-x 0/0               0 2026-11-07 21:23 usr/share/applications
-rw-r--r-- 0/0             215 2026-11-07 21:23 usr/share/applications/OpenDock.desktop
`;

const dottedContents = `-rwxr-xr-x root/root 123 2026-11-07 21:00 ./usr/bin/opendock-desktop
-rw-r--r-- root/root 215 2026-11-07 21:00 ./usr/share/applications/OpenDock.desktop
`;

const rpmListing = `/usr/bin/opendock-desktop
/usr/share/applications/OpenDock.desktop
/usr/share/icons/hicolor/128x128/apps/opendock-desktop.png
`;

test('finds the binary and desktop file in Debian 13 dpkg-deb listings without a ./ prefix', () => {
  assert.equal(findInstalledBinary(debianContents), '/usr/bin/opendock-desktop');
  assert.equal(findDesktopFile(debianContents), '/usr/share/applications/OpenDock.desktop');
});

test('accepts older tar listings that prefix paths with ./', () => {
  assert.equal(findInstalledBinary(dottedContents), '/usr/bin/opendock-desktop');
  assert.equal(findDesktopFile(dottedContents), '/usr/share/applications/OpenDock.desktop');
});

test('accepts rpm -ql and dpkg -L absolute paths', () => {
  assert.equal(findInstalledBinary(rpmListing), '/usr/bin/opendock-desktop');
  assert.equal(findDesktopFile(rpmListing), '/usr/share/applications/OpenDock.desktop');
});

test('does not treat a ./usr/bin path as missing when the regex required a dot prefix', () => {
  assert.equal(listingPath('usr/bin/opendock-desktop'), '/usr/bin/opendock-desktop');
  assert.equal(listingPath('./usr/bin/opendock-desktop'), '/usr/bin/opendock-desktop');
  assert.equal(listingPath('/usr/bin/opendock-desktop'), '/usr/bin/opendock-desktop');
});

test('resolves a usr/bin symlink to the link path, not the target', () => {
  assert.equal(
    listingPath('lrwxrwxrwx 0/0 0 2026-11-07 21:00 usr/bin/opendock -> ../lib/opendock/opendock'),
    '/usr/bin/opendock',
  );
});

test('ignores directories and nested paths', () => {
  assert.equal(findInstalledBinary('usr/bin\nusr/lib/opendock/opendock-desktop\n'), null);
  assert.equal(findDesktopFile('usr/share/applications\nusr/share/applications/extra/OpenDock.desktop\n'), null);
});
