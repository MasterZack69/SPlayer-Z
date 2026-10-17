import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updatePower: vi.fn(),
  releasePower: vi.fn(),
  created: [] as Array<(player: unknown) => void>,
  nativeEvent: (_event: { type: string; state?: string }) => {},
  state: "playing",
  finished: false,
  pause: vi.fn(),
  powerEvents: new Map<string, () => void>(),
  appEvents: new Map<string, Array<() => void>>(),
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  reset: [] as Array<() => void>,
  transition: vi.fn(),
  load: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  metadata: vi.fn(),
  prepareTransition: vi.fn(),
  cancel: vi.fn(),
  streamingPrepare: vi.fn(),
  streamingStart: vi.fn(),
  streamingStop: vi.fn(),
  mediaEvent: (_event: { type: string; positionMs?: number }) => {},
  scrobbleRestart: vi.fn(),
  lastfmRestart: vi.fn(),
}));
vi.mock("electron", () => ({
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) =>
      mocks.handlers.set(name, callback),
    on: vi.fn(),
  },
  powerMonitor: {
    on: (name: string, callback: () => void) => mocks.powerEvents.set(name, callback),
  },
  app: {
    on: (name: string, callback: () => void) => {
      mocks.appEvents.set(name, [...(mocks.appEvents.get(name) ?? []), callback]);
    },
  },
}));
vi.mock("@main/services/engine", () => {
  const player = {
    transitionToPrepared: mocks.transition,
    load: mocks.load,
    stop: mocks.stop,
    pause: mocks.pause,
    onEvent: (callback: typeof mocks.nativeEvent) => {
      mocks.nativeEvent = callback;
    },
    seek: mocks.seek,
    getDuration: () => 10,
    getPosition: () => 5,
    getSpeed: () => 1,
    getVolume: () => 1,
    getCoverRaw: () => null,
    getStatus: () => ({ state: mocks.state, isFinished: mocks.finished }),
  };
  return {
    getPlayer: () => player,
    onPlayerCreated: (callback: (player: unknown) => void) => mocks.created.push(callback),
    onPlayerReset: (callback: () => void) => mocks.reset.push(callback),
    resetPlayer: () => mocks.reset.forEach((callback) => callback()),
  };
});
vi.mock("@main/services/playerPreload", () => ({
  prepareNextTrack: vi.fn(),
  cancelPreparedTrack: mocks.cancel,
  takeTransitionReady: vi.fn(),
  setCurrentTransitionRange: vi.fn(),
  getTransitionEndMs: (end: number) => end,
}));
vi.mock("@main/utils/logger", () => ({
  playerLog: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@main/services/media", () => ({
  setMetadata: mocks.metadata,
  setPlayState: vi.fn(),
  setTimeline: vi.fn(),
  onEvent: (callback: typeof mocks.mediaEvent) => {
    mocks.mediaEvent = callback;
  },
}));
vi.mock("@main/services/nowPlaying", () => ({
  prepareTransition: mocks.prepareTransition,
  onPlayStateChange: vi.fn(),
}));
vi.mock("@main/services/device", () => ({
  requestReinit: vi.fn(),
  cancelPendingReinit: vi.fn(),
  startDeviceMonitoring: vi.fn(),
  stopDeviceMonitoring: vi.fn(),
}));
vi.mock("@main/utils/broadcast", () => ({ sendToMain: vi.fn() }));
vi.mock("@main/server/broadcast", () => ({ wsBroadcast: vi.fn() }));
vi.mock("@main/utils/encoding", () => ({}));
vi.mock("@main/utils/protocol", () => ({ toCacheUrl: () => undefined }));
vi.mock("@main/utils/config", () => ({ appName: "SPlayer-Z" }));
vi.mock("@main/utils/fetchBytes", () => ({}));
vi.mock("@main/utils/powerBlocker", () => ({
  updatePowerBlocker: mocks.updatePower,
  releasePowerBlocker: mocks.releasePower,
}));
vi.mock("@main/services/lastfm", () => ({
  onTrackLoaded: vi.fn(),
  onState: vi.fn(),
  onEnded: vi.fn(),
  onStopped: vi.fn(),
  onRepeatOneRestart: mocks.lastfmRestart,
}));
vi.mock("@main/services/streaming/playback", () => ({
  prepareStreamingPlayback: mocks.streamingPrepare,
  startStreamingPlayback: mocks.streamingStart,
  stopStreamingPlayback: mocks.streamingStop,
  onStreamingSeek: vi.fn(),
  onStreamingState: vi.fn(),
}));
vi.mock("@main/services/streaming/adapters/resolve", () => ({
  invalidateStreamingSession: vi.fn(),
}));
vi.mock("@main/services/thumbar", () => ({ getThumbar: () => null }));
vi.mock("@main/services/tray", () => ({ setTraySongName: vi.fn(), setTrayPlayState: vi.fn() }));
vi.mock("@main/services/thumbnail", () => ({ setTaskbarThumbnailCover: vi.fn() }));
vi.mock("@main/window", () => ({ getMainWindow: () => null }));
vi.mock("@main/store", () => ({ store: { get: () => false } }));

const meta = { title: "Next", duration: 10, artist: "", album: "" };
const options = { meta: { id: "next", title: "Next", source: "local", artists: [] } };

/**
 * 调用注册后的 IPC 处理器，验证原生响应提交顺序
 * @param name - IPC 通道
 * @param args - 通道参数
 * @returns 处理器返回值
 */
const invoke = (name: string, ...args: unknown[]) => mocks.handlers.get(name)!(null, ...args);

describe("交接响应的主进程竞态保护", () => {
  it("单曲重播仅重置保留的 Last.fm 统计轮次", async () => {
    expect(await invoke("player:seek", 0, true)).toEqual({ success: true });
    expect(mocks.scrobbleRestart).not.toHaveBeenCalled();
    expect(mocks.lastfmRestart).toHaveBeenCalledOnce();
    expect(mocks.lastfmRestart.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.seek.mock.invocationCallOrder[0]!,
    );
    expect(await invoke("player:seek", 1000)).toEqual({ success: true });
    expect(mocks.scrobbleRestart).not.toHaveBeenCalled();
    expect(mocks.lastfmRestart).toHaveBeenCalledOnce();
  });
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.reset.length = 0;
    mocks.created.length = 0;
    mocks.powerEvents.clear();
    mocks.appEvents.clear();
    mocks.state = "playing";
    mocks.finished = false;
    mocks.seek.mockResolvedValue(undefined);
    mocks.load.mockResolvedValue(meta);
    mocks.streamingPrepare.mockReset().mockResolvedValue(undefined);
    mocks.streamingStop.mockResolvedValue(undefined);
    const { registerPlayerIpc } = await import("./player");
    registerPlayerIpc();
    const { getPlayer } = await import("@main/services/engine");
    mocks.created.forEach((callback) => callback(getPlayer()));
  });

  it.each(["停止", "跳转", "重置", "加载新曲", "系统停止", "系统跳转"])(
    "%s 后不提交迟到的交接元数据",
    async (action) => {
      let finish!: (value: unknown) => void;
      mocks.transition.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const pending = invoke(
        "player:transitionPrepared",
        "slot",
        "next.wav",
        5000,
        "standard",
        options,
      );
      if (action === "系统停止") mocks.mediaEvent({ type: "Stop" });
      if (action === "系统跳转") mocks.mediaEvent({ type: "Seek", positionMs: 1000 });
      if (action === "停止") await invoke("player:stop");
      if (action === "跳转") await invoke("player:seek", 1000);
      if (action === "重置") mocks.reset.forEach((callback) => callback());
      if (action === "加载新曲") await invoke("player:load", "chosen.wav", {});
      mocks.metadata.mockClear();
      finish(meta);
      expect(await pending).toEqual({ success: false });
      expect(mocks.metadata).not.toHaveBeenCalled();
      expect(mocks.prepareTransition).not.toHaveBeenCalled();
    },
  );

  it("停止后忽略旧交接错误，避免渲染端误触发下一曲", async () => {
    let reject!: (error: Error) => void;
    mocks.transition.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const pending = invoke(
      "player:transitionPrepared",
      "slot",
      "next.wav",
      5000,
      "standard",
      options,
    );
    await invoke("player:stop");
    reject(new Error("旧交接超时"));
    expect(await pending).toEqual({ success: false });
  });

  it("仍有效的交接正常更新媒体元数据", async () => {
    mocks.transition.mockResolvedValueOnce(meta);
    expect(
      await invoke("player:transitionPrepared", "slot", "next.wav", 5000, "standard", options),
    ).toMatchObject({ success: true, data: { playback: { state: "playing" } } });
    expect(mocks.metadata).toHaveBeenCalledOnce();
    expect(mocks.prepareTransition).toHaveBeenCalledOnce();
  });

  it("流媒体加载由主进程解析地址，解码成功后才绑定播放会话", async () => {
    mocks.streamingPrepare.mockResolvedValueOnce({
      url: "https://server/audio",
      sessionId: "new-play",
    });
    const track = {
      id: "server:song",
      originalId: "song",
      serverId: "server",
      source: "streaming",
      title: "歌曲",
      artists: [],
      duration: 10000,
    };
    expect(await invoke("player:load", "streaming://server/song", { meta: track })).toMatchObject({
      success: true,
    });
    expect(mocks.load).toHaveBeenCalledWith("https://server/audio", true, undefined);
    expect(mocks.streamingStart).toHaveBeenCalledWith(
      track,
      { url: "https://server/audio", sessionId: "new-play" },
      10000,
      true,
    );
  });

  it("停止时作废尚未完成的流媒体地址解析，不能产生迟到播放会话", async () => {
    let finish!: (value: unknown) => void;
    mocks.streamingPrepare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const track = {
      id: "server:song",
      originalId: "song",
      serverId: "server",
      source: "streaming",
      title: "歌曲",
      artists: [],
      duration: 10000,
    };
    const pending = invoke("player:load", "streaming://server/song", { meta: track });
    await invoke("player:stop");
    finish({ url: "https://server/audio", sessionId: "old-play" });
    expect(await pending).toMatchObject({ success: false });
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.streamingStart).not.toHaveBeenCalled();
  });

  it.each([
    ["[DecodeFailed] invalid audio data", "FILE_DECODE_ERROR"],
    ["[SourceNotFound] HTTP 404", "FILE_NOT_FOUND"],
    ["[NetworkUnreachable] connection refused", "NETWORK_ERROR"],
    ["[Device] output unavailable", "DEVICE_NOT_FOUND"],
    ["[Cancelled] superseded", "LOAD_SUPERSEDED"],
    ["unclassified remote error", "NETWORK_ERROR"],
  ])("远程音源保留原生错误分类 %s", async (message, error) => {
    mocks.load.mockRejectedValueOnce(new Error(message));
    expect(await invoke("player:load", "https://music/song.flac", {})).toEqual({
      success: false,
      error,
    });
  });
  it.each(["player:pause", "player:stop"])(
    "%s releases sleep inhibition even if native control fails",
    async (channel) => {
      mocks.pause.mockImplementationOnce(() => {
        throw new Error("device lost");
      });
      mocks.stop.mockImplementationOnce(() => {
        throw new Error("device lost");
      });
      expect(await invoke(channel)).toMatchObject({ success: false });
      expect(mocks.releasePower).toHaveBeenCalled();
    },
  );

  it.each(["ended", "sourceError", "outputFailed", "outputStalled"])(
    "%s releases without waiting for StateChanged",
    (type) => {
      mocks.nativeEvent({ type });
      expect(mocks.releasePower).toHaveBeenCalledOnce();
    },
  );

  it.each(["paused", "stopped", "idle"])(
    "a queued Playing event cannot inhibit sleep when native state is %s",
    (state) => {
      mocks.state = state;
      mocks.nativeEvent({ type: "stateChanged", state: "playing" });
      expect(mocks.updatePower).toHaveBeenLastCalledWith(false);
    },
  );

  it("only inhibits for unfinished playing audio, and ignores reset-instance callbacks", () => {
    mocks.nativeEvent({ type: "stateChanged", state: "playing" });
    expect(mocks.updatePower).toHaveBeenLastCalledWith(true);
    mocks.finished = true;
    mocks.nativeEvent({ type: "stateChanged", state: "playing" });
    expect(mocks.updatePower).toHaveBeenLastCalledWith(false);
    mocks.reset.forEach((callback) => callback());
    expect(mocks.releasePower).toHaveBeenCalled();
    mocks.updatePower.mockClear();
    mocks.nativeEvent({ type: "stateChanged", state: "playing" });
    expect(mocks.updatePower).not.toHaveBeenCalled();
  });

  it.each(["Pause", "Stop"])("MPRIS %s releases inhibition immediately", (type) => {
    mocks.mediaEvent({ type });
    expect(mocks.releasePower).toHaveBeenCalled();
  });

  it("failed loading and system suspend release any existing inhibition", async () => {
    mocks.load.mockRejectedValueOnce(new Error("broken source"));
    await invoke("player:load", "broken.wav", {});
    expect(mocks.releasePower).toHaveBeenCalledTimes(2);
    mocks.releasePower.mockClear();
    mocks.powerEvents.get("suspend")!();
    expect(mocks.releasePower).toHaveBeenCalledOnce();
  });
  it("ignores callbacks after shutdown starts, even before the process exits", () => {
    mocks.appEvents.get("before-quit")![0]();
    expect(mocks.releasePower).toHaveBeenCalled();
    mocks.nativeEvent({ type: "stateChanged", state: "playing" });
    expect(mocks.updatePower).not.toHaveBeenCalled();
  });

  it("a delayed Paused event does not clear a resumed player's inhibitor", () => {
    mocks.state = "playing";
    mocks.nativeEvent({ type: "stateChanged", state: "paused" });
    expect(mocks.updatePower).toHaveBeenLastCalledWith(true);
  });
});
