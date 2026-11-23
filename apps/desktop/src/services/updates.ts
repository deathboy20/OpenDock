import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { getUpdateStatus, on, type UpdateStatus } from "./ipc";

/** The latest update check, kept current from `update:status`. Null until known. */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let live = true;
    void getUpdateStatus()
      .then((s) => live && setStatus(s))
      .catch(() => undefined);
    const off = on("update:status", (s) => setStatus(s));
    return () => {
      live = false;
      off();
    };
  }, []);
  return status;
}

/** One line for the settings page, in plain words. */
export function updateSummary(status: UpdateStatus | null, checkOn: boolean): string {
  if (!status) return checkOn ? "OpenDock checks once a day." : "Automatic checks are off.";
  if (status.available && status.latest) return `Version ${status.latest.version} is ready to download. You have ${status.current}.`;
  if (status.error) return `Couldn't check: ${status.error}.`;
  if (status.checkedAt) return `You have the latest version, ${status.current}.`;
  return checkOn ? `You have ${status.current}. OpenDock checks once a day.` : `You have ${status.current}. Automatic checks are off.`;
}
