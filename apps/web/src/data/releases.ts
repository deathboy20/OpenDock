import { site } from "./site";

export type PlatformId = "windows" | "macos" | "linux";

export type Platform = {
  id: PlatformId;
  name: string;
  /** Windows is supported; macOS and Linux packages build and install but their runtime is untested. */
  status: "supported" | "experimental";
  requirement: string;
  summary: string;
};

export type ReleaseFile = {
  platform: PlatformId;
  kind: "setup" | "msi" | "dmg" | "appimage" | "deb" | "rpm";
  arch: "x64" | "arm64" | "universal";
  name: string;
  label: string;
  note: string;
};

export type Release = {
  version: string;
  tag: string;
  date: string;
  files: ReleaseFile[];
};

export const platforms: readonly Platform[] = [
  {
    id: "windows",
    name: "Windows",
    status: "supported",
    requirement: "Windows 10 or 11, 64-bit",
    summary: "The full dock: taskbar replacement, live window previews and every widget.",
  },
  {
    id: "macos",
    name: "macOS",
    status: "experimental",
    requirement: "Apple silicon or Intel, one universal build",
    summary: "Built by the release pipeline, not yet tested on a Mac. The taskbar features are Windows-only.",
  },
  {
    id: "linux",
    name: "Linux",
    status: "experimental",
    requirement: "x64 or arm64, glibc-based distributions",
    summary: "CI checks that the packages install, not yet tested on a desktop. The taskbar features are Windows-only.",
  },
];

export const currentRelease: Release = {
  version: "0.4.0",
  tag: "v0.4.0",
  date: "2026-11-23",
  files: [
    {
      platform: "windows",
      kind: "setup",
      arch: "x64",
      name: "OpenDock_0.4.0_x64-setup.exe",
      label: "Installer (.exe)",
      note: "Recommended. Installs for your account, no admin rights needed.",
    },
    {
      platform: "windows",
      kind: "msi",
      arch: "x64",
      name: "OpenDock_0.4.0_x64_en-US.msi",
      label: "Windows Installer (.msi)",
      note: "For deployment with Group Policy, Intune or other management tools.",
    },
    {
      platform: "macos",
      kind: "dmg",
      arch: "universal",
      name: "OpenDock_0.4.0_universal.dmg",
      label: "Disk image (.dmg)",
      note: "One download for Apple silicon and Intel Macs. Not signed or notarised.",
    },
    {
      platform: "linux",
      kind: "appimage",
      arch: "x64",
      name: "OpenDock_0.4.0_amd64.AppImage",
      label: "AppImage, x64",
      note: "Runs without installing on most glibc-based distributions.",
    },
    {
      platform: "linux",
      kind: "appimage",
      arch: "arm64",
      name: "OpenDock_0.4.0_aarch64.AppImage",
      label: "AppImage, arm64",
      note: "The same, for ARM computers.",
    },
    {
      platform: "linux",
      kind: "deb",
      arch: "x64",
      name: "OpenDock_0.4.0_amd64.deb",
      label: "Debian package, x64",
      note: "Debian, Ubuntu, Linux Mint and their relatives.",
    },
    {
      platform: "linux",
      kind: "deb",
      arch: "arm64",
      name: "OpenDock_0.4.0_arm64.deb",
      label: "Debian package, arm64",
      note: "The same, for ARM computers.",
    },
    {
      platform: "linux",
      kind: "rpm",
      arch: "x64",
      name: "OpenDock-0.4.0-1.x86_64.rpm",
      label: "RPM package, x64",
      note: "Fedora, RHEL, openSUSE and their relatives.",
    },
    {
      platform: "linux",
      kind: "rpm",
      arch: "arm64",
      name: "OpenDock-0.4.0-1.aarch64.rpm",
      label: "RPM package, arm64",
      note: "The same, for ARM computers.",
    },
  ],
};

export function filesFor(release: Release, platform: PlatformId): ReleaseFile[] {
  return release.files.filter((file) => file.platform === platform);
}

/** The file a visitor on that platform should try first. */
export function primaryFile(release: Release, platform: PlatformId): ReleaseFile {
  const preferred = { windows: "setup", macos: "dmg", linux: "appimage" } as const;
  const file = release.files.find((item) => item.platform === platform && item.kind === preferred[platform]);
  if (!file) throw new Error(`No ${preferred[platform]} file for ${platform} in ${release.version}`);
  return file;
}

export function downloadUrl(release: Release, file: string): string {
  return `${site.repo}/releases/download/${release.tag}/${file}`;
}

export function releasePageUrl(release: Release): string {
  return `${site.repo}/releases/tag/${release.tag}`;
}

export const checksumsFile = "SHA256SUMS.txt";

export function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
