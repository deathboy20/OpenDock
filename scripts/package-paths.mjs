/** Paths from `dpkg -L`, `rpm -ql`, or `dpkg-deb --contents` listings. */

export function listingPath(line) {
  const trimmed = line.trim();
  if (!trimmed) return '';
  const withoutLink = trimmed.includes(' -> ') ? trimmed.slice(0, trimmed.indexOf(' -> ')) : trimmed;
  if (withoutLink.startsWith('/') || withoutLink.startsWith('./') || /^(usr|opt)\//.test(withoutLink)) {
    return absoluteUnixPath(withoutLink);
  }
  const fields = withoutLink.split(/\s+/);
  return absoluteUnixPath(fields.at(-1) ?? '');
}

function absoluteUnixPath(path) {
  const stripped = path.replace(/^\.\//, '');
  if (!stripped || stripped === '.') return '';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function findInstalledBinary(listing) {
  return listing.split('\n').map(listingPath).find((path) => /^\/usr\/bin\/[^/]+$/.test(path)) ?? null;
}

export function findDesktopFile(listing) {
  return listing.split('\n').map(listingPath).find((path) => /^\/usr\/share\/applications\/[^/]+\.desktop$/.test(path)) ?? null;
}
