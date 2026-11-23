import { useEffect, useState } from "react";
import { getAppIcon } from "./ipc";

/** How long a missing icon is trusted before asking again. Windows' shell can fail to hand
 * out an icon while it is busy (at sign-in, for example). */
export const ICON_RETRY_MS = 20_000;
const MAX_TRIES = 4;

type Entry = { url: string | null; at: number; tries: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<string | null>>();

/** A found icon is kept; a missing one is asked for again after a while, a few times. */
export function shouldRefetch(entry: Entry | undefined, now: number): boolean {
  if (!entry) return true;
  if (entry.url !== null) return false;
  return entry.tries < MAX_TRIES && now - entry.at >= ICON_RETRY_MS;
}

function fetchIcon(path: string, window?: number): Promise<string | null> {
  const key = path.toLowerCase();
  const hit = cache.get(key);
  if (hit && !shouldRefetch(hit, Date.now())) return Promise.resolve(hit.url);
  let request = pending.get(key);
  if (!request) {
    request = getAppIcon(path, window)
      .catch(() => null)
      .then((icon) => {
        cache.set(key, { url: icon, at: Date.now(), tries: (hit?.tries ?? 0) + 1 });
        pending.delete(key);
        return icon;
      });
    pending.set(key, request);
  }
  return request;
}

/** The app's icon as a data URL, or null while loading or when it has none. */
export function useAppIcon(path: string | null, windowId?: number): string | null {
  const key = path?.toLowerCase() ?? "";
  const [icon, setIcon] = useState<{ key: string; url: string | null }>(() => ({
    key,
    url: path ? (cache.get(key)?.url ?? null) : null,
  }));

  useEffect(() => {
    if (!path) return;
    let live = true;
    let timer: number | undefined;
    const load = () =>
      void fetchIcon(path, windowId).then((url) => {
        if (!live) return;
        setIcon({ key, url });
        // Ask again later if Windows had no icon for it this time.
        const entry = cache.get(key);
        if (url === null && entry && entry.tries < MAX_TRIES) timer = window.setTimeout(load, ICON_RETRY_MS);
      });
    load();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [path, key, windowId]);

  return icon.key === key ? icon.url : (cache.get(key)?.url ?? null);
}
