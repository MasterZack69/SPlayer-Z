import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaEvent, MetadataParam } from "@splayer/media-ctrl";

const mocks = vi.hoisted(() => ({
  enabled: true,
  callback: null as ((event: MediaEvent) => void) | null,
  native: {
    initLogger: vi.fn(),
    initialize: vi.fn(),
    onEvent: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    shutdown: vi.fn(),
    setMetadata: vi.fn(),
    setPlayState: vi.fn(),
    setTimeline: vi.fn(),
    setRate: vi.fn(),
    setVolume: vi.fn(),
  },
  error: vi.fn(),
}));
vi.mock("@main/utils/nativeLoader", () => ({ loadNativeModule: () => mocks.native }));
vi.mock("@main/utils/logger", () => ({
  nativeLogsDir: "/logs",
  mediaLog: { info: vi.fn(), warn: vi.fn(), error: mocks.error },
}));
vi.mock("@main/utils/config", () => ({ isDev: false }));
vi.mock("@main/store", () => ({
  store: { get: () => ({ systemMediaControls: mocks.enabled }) },
}));
import * as media from "./media";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.callback = null;
  mocks.native.onEvent.mockImplementation((callback) => {
    mocks.callback = callback;
  });
});

describe("Linux system media controls without Discord RPC", () => {
  it("initializes and enables MPRIS using only the remaining native API", () => {
    media.init();
    expect(mocks.native.initialize).toHaveBeenCalledOnce();
    expect(mocks.native.enable).toHaveBeenCalledOnce();
    expect(mocks.native.onEvent).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(media).not.toHaveProperty("reloadDiscordConfig");
  });

  it("respects disabled system controls and retains runtime enable/disable", () => {
    mocks.enabled = false;
    media.init();
    expect(mocks.native.enable).not.toHaveBeenCalled();
    media.enable();
    media.disable();
    media.shutdown();
    expect(mocks.native.enable).toHaveBeenCalledOnce();
    expect(mocks.native.disable).toHaveBeenCalledOnce();
    expect(mocks.native.shutdown).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("preserves artwork, artist lists, playback state, position, rate, and volume", () => {
    media.init();
    const metadata: MetadataParam = {
      title: "Local music",
      artists: ["First artist", "Second artist"],
      album: "Album",
      coverData: Buffer.from([1, 2, 3]),
      coverUrl: "https://example.com/cover.jpg",
      durationMs: 180000,
    };
    media.setMetadata(metadata);
    media.setPlayState({ status: "Paused" });
    media.setTimeline({ currentMs: 5000, totalMs: 180000 });
    media.setRate(1.25);
    media.setVolume(0.5);
    expect(mocks.native.setMetadata).toHaveBeenCalledWith(metadata);
    expect(mocks.native.setPlayState).toHaveBeenCalledWith({ status: "Paused" });
    expect(mocks.native.setTimeline).toHaveBeenCalledWith({ currentMs: 5000, totalMs: 180000 });
    expect(mocks.native.setRate).toHaveBeenCalledWith(1.25);
    expect(mocks.native.setVolume).toHaveBeenCalledWith(0.5);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("continues forwarding system media-key events", () => {
    const onEvent = vi.fn();
    media.onEvent(onEvent);
    media.init();
    mocks.callback?.({ type: "NextTrack" });
    expect(onEvent).toHaveBeenCalledWith({ type: "NextTrack" });
  });
});
