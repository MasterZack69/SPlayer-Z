import { describe, expect, it, vi } from "vitest";
import { configureLinuxGraphics } from "./chromium";

/** Create an in-memory command line that records Chromium switches. */
const commandLine = (values: Record<string, string> = {}) => ({
  getSwitchValue: (name: string) => values[name] ?? "",
  appendSwitch: vi.fn((name: string, value = "") => {
    values[name] = value;
  }),
});

describe("native Wayland graphics", () => {
  it("disables Vulkan and preserves other disabled features", () => {
    const cli = commandLine({ "disable-features": "SpareRendererForSitePerProcess,Example" });
    configureLinuxGraphics(cli, "linux", { WAYLAND_DISPLAY: "wayland-1" });
    expect(cli.getSwitchValue("disable-features")).toBe(
      "SpareRendererForSitePerProcess,Example,Vulkan",
    );
    expect(cli.appendSwitch).toHaveBeenCalledWith("disable-vulkan");
    expect(cli.appendSwitch).not.toHaveBeenCalledWith("disable-gpu");
  });
  it("honors an explicit X11 override in a Wayland session", () => {
    const cli = commandLine({ "ozone-platform": "x11" });
    configureLinuxGraphics(cli, "linux", { WAYLAND_DISPLAY: "wayland-1" });
    expect(cli.appendSwitch).not.toHaveBeenCalled();
  });
  it("handles automatic Ozone selection in a Wayland session", () => {
    const cli = commandLine({ "ozone-platform": "auto" });
    configureLinuxGraphics(cli, "linux", { WAYLAND_DISPLAY: "wayland-1" });
    expect(cli.appendSwitch).toHaveBeenCalledWith("disable-vulkan");
  });
  it("handles explicit Wayland without environment detection", () => {
    const cli = commandLine({ "ozone-platform": "wayland" });
    configureLinuxGraphics(cli, "linux", {});
    expect(cli.appendSwitch).toHaveBeenCalledWith("disable-vulkan");
  });
  it.each(["darwin", "win32"])("leaves %s graphics unchanged", (platform) => {
    const cli = commandLine();
    configureLinuxGraphics(cli, platform, { WAYLAND_DISPLAY: "wayland-1" });
    expect(cli.appendSwitch).not.toHaveBeenCalled();
  });
  it("leaves ordinary X11 sessions unchanged", () => {
    const cli = commandLine();
    configureLinuxGraphics(cli, "linux", { DISPLAY: ":0" });
    expect(cli.appendSwitch).not.toHaveBeenCalled();
  });
});
