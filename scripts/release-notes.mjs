import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function isPrerelease(version) {
  return VERSION_PATTERN.test(version) && version.includes('-');
}

export function releaseTitle(version) {
  if (!VERSION_PATTERN.test(version)) throw new Error('Invalid package version');
  return `OpenDock ${version}`;
}

export function extractChangelogSection(changelog, version) {
  if (!VERSION_PATTERN.test(version)) throw new Error('Invalid package version');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^## \\[${escaped}\\](?:\\s|$)`);
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## \[/.test(lines[i])) break;
    body.push(lines[i]);
  }
  const text = body.join('\n').trim();
  if (!text) throw new Error(`CHANGELOG.md section for ${version} is empty`);
  return text;
}

export function buildReleaseNotes({ changelog, version, signingStatus = 'unsigned' }) {
  const section = extractChangelogSection(changelog, version);
  const macos =
    signingStatus.trim() === 'signed and notarized'
      ? 'macOS DMG: code-signed and notarized.'
      : 'macOS DMG: unsigned and unnotarized; follow the Gatekeeper instructions in the installation guide.';
  return `${section}

## Platform support

- **Windows 10/11 (x64):** supported. Use the \`.exe\` installer, or the \`.msi\` for managed deployment.
- **Linux (AppImage, \`.deb\`, \`.rpm\`) and macOS (universal \`.dmg\`):** experimental. The packages install; they do not replace the system shell yet.

Builds are unsigned unless noted below. Check \`SHA256SUMS.txt\` before you install.

${macos}
`;
}

function argValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return undefined;
  return args[index + 1];
}

function writeGitHubOutput(file, key, value) {
  if (/[\n\r]/.test(value)) throw new Error(`Refusing multiline GitHub output for ${key}`);
  appendFileSync(file, `${key}=${value}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const version = argValue(args, '--version');
  const changelogPath = argValue(args, '--changelog');
  const notesPath = argValue(args, '--notes-file');
  if (!version || !changelogPath || !notesPath) {
    throw new Error('Usage: node scripts/release-notes.mjs --version <version> --changelog CHANGELOG.md --notes-file notes.md [--signing-status TEXT] [--signing-status-file FILE] [--github-output FILE]');
  }
  const signingFile = argValue(args, '--signing-status-file');
  const signingStatus = signingFile
    ? readFileSync(signingFile, 'utf8')
    : (argValue(args, '--signing-status') ?? 'unsigned');
  const notes = buildReleaseNotes({
    changelog: readFileSync(changelogPath, 'utf8'),
    version,
    signingStatus,
  });
  writeFileSync(notesPath, notes);
  const githubOutput = argValue(args, '--github-output');
  if (githubOutput) {
    writeGitHubOutput(githubOutput, 'prerelease', isPrerelease(version) ? 'true' : 'false');
    writeGitHubOutput(githubOutput, 'title', releaseTitle(version));
  }
}
