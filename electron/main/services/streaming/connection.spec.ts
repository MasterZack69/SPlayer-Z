import { beforeEach, describe, expect, it, vi } from "vitest";
import { StreamingCredentialError, StreamingRequestError } from "./errors";
const state = vi.hoisted(() => ({
  revision: 0,
  configError: null as Error | null,
  resolve: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("./config", () => ({
  getStreamingServer: () => {
    if (state.configError) throw state.configError;
    return { id: "server", type: "jellyfin", revision: state.revision };
  },
  createTestStreamingServer: () => {
    if (state.configError) throw state.configError;
    return { id: "test-server", type: "subsonic", revision: state.revision };
  },
  markStreamingServerConnected: () => ({ id: "server" }),
  getStreamingServerRevision: () => state.revision,
}));
vi.mock("./adapters/resolve", () => ({
  resolveStreamingAdapter: state.resolve,
  invalidateStreamingSession: state.invalidate,
}));
vi.mock("@main/utils/logger", () => ({ streamingLog: { warn: vi.fn() } }));
import {
  withStreamingAdapter,
  connectStreamingServer,
  testStreamingConnection,
} from "./connection";
beforeEach(() => {
  state.revision = 0;
  state.configError = null;
  state.resolve.mockReset().mockImplementation(async (config) => ({ config, adapter: {} }));
  state.invalidate.mockClear();
});

describe("流媒体会话恢复", () => {
  it("401 只重新登录并重试一次", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new StreamingRequestError("expired", 401))
      .mockResolvedValueOnce("ok");
    expect(await withStreamingAdapter("server", request)).toBe("ok");
    expect(state.invalidate).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("403 权限拒绝不会重复登录", async () => {
    const request = vi.fn().mockRejectedValue(new StreamingRequestError("forbidden", 403));
    await expect(withStreamingAdapter("server", request)).rejects.toMatchObject({ status: 403 });
    expect(state.invalidate).not.toHaveBeenCalled();
  });
  it("鉴权期间修改配置不会向旧服务器执行写操作", async () => {
    state.resolve.mockImplementationOnce(async (config) => {
      state.revision++;
      return { config, adapter: {} };
    });
    const request = vi.fn();
    await expect(withStreamingAdapter("server", request)).rejects.toThrow("已作废");
    expect(request).not.toHaveBeenCalled();
  });
  it("配置更新后迟到请求作废", async () => {
    await expect(
      withStreamingAdapter("server", async () => {
        state.revision++;
        return true;
      }),
    ).rejects.toThrow("已作废");
  });
});

describe("local credential failures", () => {
  const input = {
    name: "Server",
    type: "subsonic" as const,
    url: "https://server",
    username: "user",
    password: "",
  };

  it("returns a storage error before any network request for Test and Connect", async () => {
    state.configError = new StreamingCredentialError(
      "Unable to decrypt the media server password; re-enter it",
    );
    for (const result of [
      await testStreamingConnection(input, "server"),
      await connectStreamingServer("server"),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        code: "storage",
        error: state.configError.message,
      });
    }
    expect(state.resolve).not.toHaveBeenCalled();
    expect(state.invalidate).not.toHaveBeenCalled();
  });

  it("keeps real authentication failures separate from credential storage", async () => {
    state.resolve.mockRejectedValue(new StreamingRequestError("HTTP 401", 401));
    expect(await testStreamingConnection(input)).toMatchObject({ ok: false, code: "auth" });
    expect(state.invalidate).toHaveBeenCalledWith("test-server");
  });

  it("invalidates test sessions after success", async () => {
    state.resolve.mockImplementation(async (config) => ({
      config,
      adapter: { ping: async () => ({ ok: true }) },
    }));
    expect(await testStreamingConnection(input)).toEqual({ ok: true });
    expect(state.invalidate).toHaveBeenCalledWith("test-server");
  });
});
