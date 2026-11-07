import { defaultAppSettings, type DockSettings } from "@opendock/config-schema";
import { cleanup, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppearanceEditor } from "./AppearanceEditor";

function Harness({
  shell = "windows",
  initial = defaultAppSettings.dock,
}: {
  shell?: "windows" | "macos" | "gnome-wayland";
  initial?: DockSettings;
}) {
  const [dock, setDock] = useState(initial);
  return (
    <AppearanceEditor
      dock={dock}
      shell={shell}
      onCommit={async (next) => {
        setDock(next);
        return null;
      }}
    />
  );
}

afterEach(() => cleanup());

describe("AppearanceEditor", () => {
  it("keeps Undo and Reset in place, and moves the dock with the arrow keys", async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<Harness />);
    expect(getByRole("button", { name: "Undo, nothing to undo" })).toBeEnabled();
    expect(getByRole("button", { name: "Reset, already the default look" })).toBeEnabled();

    const desk = getByRole("slider", { name: /Where the dock sits, Bottom/ });
    desk.focus();
    await user.keyboard("{ArrowLeft}");

    expect(getByRole("slider", { name: /Where the dock sits, Left/ })).toBeInTheDocument();
    expect(getByRole("status")).toHaveTextContent("Moved the dock to the left.");
    await user.click(getByRole("button", { name: "Undo" }));
    expect(getByRole("slider", { name: /Where the dock sits, Bottom/ })).toBeInTheDocument();
    expect(getByRole("status")).toHaveTextContent("Undid: Moved the dock to the left.");
  });

  it("reorders a widget from the keyboard and resets only the look", async () => {
    const user = userEvent.setup();
    const { getByRole, container } = render(<Harness />);
    const order = () => [...container.querySelectorAll("[data-preview-id]")].map((node) => node.getAttribute("data-preview-id"));

    getByRole("button", { name: "Apps" }).focus();
    await user.keyboard(" ");
    expect(getByRole("status")).toHaveTextContent("Picked up Apps.");
    await user.keyboard("{ArrowLeft}");
    expect(order().slice(0, 2)).toEqual(["apps", "start"]);

    await user.click(getByRole("radio", { name: "Ink" }));
    await user.click(getByRole("button", { name: "Reset" }));
    expect(getByRole("radio", { name: "Glass" })).toHaveAttribute("aria-checked", "true");
    expect(order().slice(0, 2)).toEqual(["apps", "start"]);
    expect(getByRole("status")).toHaveTextContent("Reset the dock look.");
  });

  it("changes spacing from the keyboard", async () => {
    const user = userEvent.setup();
    const { getByRole } = render(<Harness />);
    const grip = getByRole("slider", { name: "Spacing" });
    grip.focus();
    await user.keyboard("{ArrowRight}");
    expect(grip).toHaveAttribute("aria-valuetext", "Roomy");
    expect(getByRole("status")).toHaveTextContent("Spacing set to Roomy.");
    await user.keyboard("{ArrowLeft}");
    expect(grip).toHaveAttribute("aria-valuetext", "Even");
  });

  it("shows a floating dock on macOS and on GNOME Wayland", () => {
    const mac = render(<Harness shell="macos" />);
    expect(mac.getByText(/does not replace the menu bar/)).toBeInTheDocument();
    expect(mac.getByText(/Not shipped yet/)).toBeInTheDocument();
    expect(mac.container.querySelector(".stage-dock")).toHaveClass("is-floating");
    expect(mac.container.textContent).not.toMatch(/taskbar/i);
    mac.unmount();

    const gnome = render(<Harness shell="gnome-wayland" />);
    expect(gnome.getByText(/can't reserve a screen edge/)).toBeInTheDocument();
    expect(within(gnome.container).getByText(/Not shipped yet/)).toBeInTheDocument();
    expect(gnome.container.querySelector(".stage-dock")).toHaveClass("is-floating");
  });
});
