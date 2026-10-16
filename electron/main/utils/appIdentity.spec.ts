// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { join } from "node:path";

const fs = vi.hoisted(() => ({ mkdirSync: vi.fn() }));
vi.mock("node:fs", () => fs);

const app = vi.hoisted(() => ({
  setName: vi.fn(),
  getPath: vi.fn(),
  setPath: vi.fn(),
  setDesktopName: vi.fn(),
}));
vi.mock("electron", () => ({ app }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  app.getPath.mockImplementation((name: string) => {
    if (name !== "appData") throw new Error(`Unexpected legacy path read: ${name}`);
    return "/home/test/.config";
  });
});

it("uses an independent SPlayer-Z profile before loading any services", async () => {
  await import("./appIdentity");
  expect(app.setName).toHaveBeenCalledWith("SPlayer-Z");
  expect(fs.mkdirSync).toHaveBeenCalledWith(join("/home/test/.config", "SPlayer-Z"), {
    recursive: true,
  });
  expect(fs.mkdirSync.mock.invocationCallOrder[0]).toBeLessThan(
    app.setPath.mock.invocationCallOrder[0],
  );
  expect(app.setPath.mock.calls).toEqual([
    ["userData", join("/home/test/.config", "SPlayer-Z")],
    ["sessionData", join("/home/test/.config", "SPlayer-Z")],
  ]);
  expect(app.setDesktopName).toHaveBeenCalledWith("io.github.MasterZack69.SPlayerZ.desktop");
  expect(app.getPath).toHaveBeenCalledExactlyOnceWith("appData");
});
