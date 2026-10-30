// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@shared/types/errors";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  dirs: [] as string[],
  set: vi.fn(),
  picker: vi.fn(),
  deleteTracksByDir: vi.fn(),
}));
vi.mock("electron", () => ({
  dialog: { showOpenDialog: mocks.picker },
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      mocks.handlers.set(name, handler),
  },
}));
vi.mock("@main/store", () => ({ store: { get: () => mocks.dirs, set: mocks.set } }));
vi.mock("@main/database", () => ({ deleteTracksByDir: mocks.deleteTracksByDir }));
vi.mock("@main/services/scanner", () => ({}));
vi.mock("@main/services/engine", () => ({}));
vi.mock("@main/utils/protocol", () => ({}));
vi.mock("@main/utils/config", () => ({}));
vi.mock("@main/utils/fetchBytes", () => ({}));
vi.mock("@main/utils/logger", () => ({ libraryLog: { info: vi.fn() } }));
import { registerLibraryIpc } from "./library";

let root: string;
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.handlers.clear();
  root = await mkdtemp(path.join(tmpdir(), "scan-roots-"));
  await mkdir(path.join(root, "music", "album"), { recursive: true });
  await mkdir(path.join(root, "music-other"));
  mocks.dirs = [path.join(root, "music")];
  registerLibraryIpc();
});
afterEach(async () => rm(root, { recursive: true, force: true }));

describe("scan-root safety", () => {
  it.each(["child", "parent", "root", "trailing", "alias"])(
    "rejects %s overlap before saving or deleting index entries",
    async (kind) => {
      let picked =
        kind === "child" ? path.join(root, "music", "album") : kind === "root" ? "/" : root;
      if (kind === "trailing") picked = `${mocks.dirs[0]}/`;
      if (kind === "alias") {
        picked = path.join(root, "alias");
        await symlink(mocks.dirs[0], picked);
      }
      mocks.picker.mockResolvedValue({ canceled: false, filePaths: [picked] });
      const result = await mocks.handlers.get("library:addScanDir")!();
      expect(result).toEqual({
        success: false,
        error: ["alias", "trailing"].includes(kind)
          ? ErrorCode.SCAN_DIR_EXISTS
          : ErrorCode.SCAN_DIR_NESTED,
      });
      expect(mocks.set).not.toHaveBeenCalled();
      expect(mocks.deleteTracksByDir).not.toHaveBeenCalled();
      expect(mocks.dirs).toEqual([path.join(root, "music")]);
    },
  );
  it("accepts a sibling whose name merely shares a prefix", async () => {
    const picked = path.join(root, "music-other");
    mocks.picker.mockResolvedValue({ canceled: false, filePaths: [picked] });
    expect(await mocks.handlers.get("library:addScanDir")!()).toEqual({
      success: true,
      data: picked,
    });
    expect(mocks.set).toHaveBeenCalledWith("library.scanDirs", [path.join(root, "music"), picked]);
  });
});
