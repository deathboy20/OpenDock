import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { buildReleaseNotes, extractChangelogSection, isPrerelease, releaseTitle } from './release-notes.mjs';

const changelog = `# Changelog

## [Unreleased]

## [0.3.0] - 2026-11-07

Live dock settings.

### Added

- A restore-the-taskbar command.

## [0.2.0] - 2026-10-21

The first release that can stand in for the Windows taskbar.
`;

test('extracts only the requested changelog section', () => {
  const section = extractChangelogSection(changelog, '0.3.0');
  assert.match(section, /Live dock settings/);
  assert.match(section, /restore-the-taskbar/);
  assert.doesNotMatch(section, /first release that can stand in/);
  assert.doesNotMatch(section, /## \[0\.3\.0\]/);
});

test('stable versions are published as Latest, pre-release versions are marked prerelease', () => {
  assert.equal(isPrerelease('0.3.0'), false);
  assert.equal(isPrerelease('0.3.0-beta.1'), true);
  assert.equal(releaseTitle('0.3.0'), 'OpenDock 0.3.0');
});

test('appends platform support and unsigned macOS guidance', () => {
  const notes = buildReleaseNotes({ changelog, version: '0.3.0', signingStatus: 'unsigned\n' });
  assert.match(notes, /## Platform support/);
  assert.match(notes, /Windows 10\/11 \(x64\):\*\* supported/);
  assert.match(notes, /SHA256SUMS\.txt/);
  assert.match(notes, /unsigned and unnotarized/);
  assert.doesNotMatch(notes, /code-signed and notarized/);
});

test('mentions notarization when macOS signing succeeded', () => {
  const notes = buildReleaseNotes({ changelog, version: '0.3.0', signingStatus: 'signed and notarized' });
  assert.match(notes, /code-signed and notarized/);
});

test('refuses a missing or empty changelog section', () => {
  assert.throws(() => extractChangelogSection(changelog, '1.0.0'), /no section/);
  assert.throws(() => extractChangelogSection('## [0.4.0] - 2026-11-07\n\n## [0.3.0]\n', '0.4.0'), /empty/);
});

test('builds notes from the repository changelog for the current package version', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const notes = buildReleaseNotes({
    changelog: readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
    version,
    signingStatus: 'unsigned',
  });
  assert.match(notes, /Platform support/);
  assert.equal(isPrerelease(version), version.includes('-'));
});

test('CLI writes notes and GitHub output for a stable version', () => {
  const root = mkdtempSync(join(tmpdir(), 'opendock-notes-'));
  const changelogPath = join(root, 'CHANGELOG.md');
  const notesPath = join(root, 'notes.md');
  const outputPath = join(root, 'github-output');
  writeFileSync(changelogPath, changelog);
  try {
    execFileSync(process.execPath, [
      join(dirname(fileURLToPath(import.meta.url)), 'release-notes.mjs'),
      '--version',
      '0.3.0',
      '--changelog',
      changelogPath,
      '--notes-file',
      notesPath,
      '--signing-status',
      'unsigned',
      '--github-output',
      outputPath,
    ]);
    const notes = readFileSync(notesPath, 'utf8');
    const output = readFileSync(outputPath, 'utf8');
    assert.match(notes, /Live dock settings/);
    assert.match(notes, /Platform support/);
    assert.equal(output, 'prerelease=false\ntitle=OpenDock 0.3.0\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
