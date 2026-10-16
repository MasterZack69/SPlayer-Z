import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  fetch: vi.fn(),
  stat: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("electron", () => ({
  protocol: { handle: mocks.handle },
  net: { fetch: mocks.fetch },
  session: { fromPartition: () => ({ protocol: { handle: mocks.handle } }) },
}));
vi.mock("node:fs/promises", () => ({ stat: mocks.stat, default: { stat: mocks.stat } }));
vi.mock("./config", () => ({ getAppCacheDir: () => "/app/cache" }));
vi.mock("./logger", () => ({ coreLog: { warn: mocks.warn } }));
import { handleCacheProtocol } from "./protocol";
let handler: (request: { url: string }) => Promise<Response>;
beforeEach(() => {
  vi.resetAllMocks();
  handleCacheProtocol();
  handler = mocks.handle.mock.calls[0][1];
  mocks.stat.mockResolvedValue({ isFile: () => true });
  mocks.fetch.mockResolvedValue(new Response("cover"));
});
describe("cached cover protocol", () => {
  it("returns 404 for stale cache entries without invoking Electron's file loader", async () => {
    mocks.stat.mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    expect((await handler({ url: "cache://covers/missing.jpg" })).status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.warn).not.toHaveBeenCalled();
  });
  it("encodes spaces, percent signs, and hash characters in file URLs", async () => {
    await handler({ url: "cache://covers/a%20%23%25.jpg?v=1" });
    expect(mocks.fetch).toHaveBeenCalledWith(
      pathToFileURL(path.resolve("/app/cache/covers/a #%.jpg")).href,
    );
  });
  it("rejects paths outside the cache", async () => {
    expect((await handler({ url: "cache://../private" })).status).toBe(403);
    expect(mocks.stat).not.toHaveBeenCalled();
  });
  it("rejects malformed encodings", async () => {
    expect((await handler({ url: "cache://covers/%ZZ" })).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("handles deletion between stat and fetch", async () => {
    mocks.fetch.mockRejectedValue(new Error("net::ERR_FILE_NOT_FOUND"));
    expect((await handler({ url: "cache://covers/removed.jpg" })).status).toBe(404);
  });
  it("logs unexpected failures rather than hiding them", async () => {
    mocks.stat.mockRejectedValue(Object.assign(new Error("denied"), { code: "EACCES" }));
    expect((await handler({ url: "cache://covers/private.jpg" })).status).toBe(500);
    expect(mocks.warn).toHaveBeenCalled();
  });
});
