interface ChromiumCommandLine {
  getSwitchValue: (name: string) => string;
  appendSwitch: (name: string, value?: string) => void;
}

/**
 * Disable unsupported Vulkan paths on native Wayland without disabling GPU acceleration.
 * @param commandLine - Chromium switches, including user-supplied flags
 * @param platform - Host operating system
 * @param env - Desktop session environment
 */
export const configureLinuxGraphics = (
  commandLine: ChromiumCommandLine,
  platform: string,
  env: NodeJS.ProcessEnv,
): void => {
  if (platform !== "linux") return;
  const ozone = commandLine.getSwitchValue("ozone-platform");
  const wayland = ozone === "wayland" || ((!ozone || ozone === "auto") && !!env.WAYLAND_DISPLAY);
  if (!wayland) return;
  const disabled = new Set(
    commandLine.getSwitchValue("disable-features").split(",").filter(Boolean),
  );
  disabled.add("Vulkan");
  commandLine.appendSwitch("disable-features", [...disabled].join(","));
  commandLine.appendSwitch("disable-vulkan");
};
