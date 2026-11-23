import { findSkin, skinVariables } from "@opendock/config-schema";
import { useEffect, useRef, type ReactNode } from "react";
import { DesktopWidgetApp } from "../features/desktop/DesktopWidgetApp";
import { DockBar } from "../features/dock/DockBar";
import { FlyoutApp } from "../features/flyout/FlyoutApp";
import { HubApp } from "../features/hub/HubApp";
import { ToastApp } from "../features/toast/ToastApp";
import { LiveDataProvider } from "../services/live";
import { SettingsProvider } from "../services/settings";
import { useSettings } from "../services/settingsContext";
import "../styles/tokens.css";
import "../styles/base.css";

export type WindowKind = "main" | "hub" | "flyout" | "toast" | "desktop";

/** Mirrors the dock's theme, style and skin onto the document so every window matches. */
function Themed({ kind, children }: { kind: WindowKind; children: ReactNode }) {
  const { settings, ready } = useSettings();
  const applied = useRef<string[]>([]);
  const skin = findSkin(settings.skins, settings.skins.active);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.window = kind;
    root.dataset.theme = settings.dock.theme;
    root.dataset.style = settings.dock.style;
    // Skin values are validated by kind in Rust and Zod, so they are plain colours, lengths,
    // durations or listed presets, never arbitrary CSS.
    const vars = skinVariables(skin, settings.dock.theme);
    for (const name of applied.current) root.style.removeProperty(name);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    applied.current = Object.keys(vars);
    if (skin) root.dataset.skin = skin.id;
    else delete root.dataset.skin;
  }, [kind, settings.dock.theme, settings.dock.style, skin]);
  return ready ? <>{children}</> : null;
}

export function App({ kind }: { kind: WindowKind }) {
  if (kind === "toast") {
    return (
      <SettingsProvider>
        <Themed kind={kind}>
          <ToastApp />
        </Themed>
      </SettingsProvider>
    );
  }
  return (
    <SettingsProvider>
      <LiveDataProvider>
        <Themed kind={kind}>
          {kind === "hub" ? (
            <HubApp />
          ) : kind === "flyout" ? (
            <FlyoutApp />
          ) : kind === "desktop" ? (
            <DesktopWidgetApp />
          ) : (
            <DockBar />
          )}
        </Themed>
      </LiveDataProvider>
    </SettingsProvider>
  );
}
