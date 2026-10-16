import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BackgroundRender from "./BackgroundRender.vue";

const { createRenderer, acquireFft, releaseFft } = vi.hoisted(() => ({
  createRenderer: vi.fn(),
  acquireFft: vi.fn(),
  releaseFft: vi.fn(),
}));
vi.mock("@applemusic-like-lyrics/core", () => ({
  BackgroundRender: { new: createRenderer },
  MeshGradientRenderer: class {},
  IsolationRenderer: class {},
  PixiRenderer: class {},
}));
vi.mock("@/services/playback", () => ({ getFftFrame: () => undefined }));
vi.mock("@/services/fftCapture", () => ({ acquireFft, releaseFft }));

/** Create a manually completed texture load for deterministic race tests. */
const pendingAlbum = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

/** Create the renderer API without a GPU or background animation loop. */
const rendererFixture = () => ({
  setAlbum: vi.fn().mockResolvedValue(undefined),
  getElement: () => document.createElement("canvas"),
  setFPS: vi.fn(),
  setRenderScale: vi.fn(),
  setHasLyric: vi.fn(),
  setStaticMode: vi.fn(),
  setFlowSpeed: vi.fn(),
  setLowFreqVolume: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  dispose: vi.fn(),
});

let frames: Map<number, FrameRequestCallback>;
let frameId: number;

/** Advance one paint while retaining callbacks scheduled for the following frame. */
const paint = () => {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(performance.now());
};

beforeEach(() => {
  frames = new Map();
  frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => vi.unstubAllGlobals());

describe("fluid texture readiness", () => {
  it("waits for the current cover to paint, not an older in-flight cover", async () => {
    const first = pendingAlbum();
    const second = pendingAlbum();
    const renderer = rendererFixture();
    renderer.setAlbum.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    createRenderer.mockReturnValue(renderer);
    const wrapper = mount(BackgroundRender, { props: { album: "first.jpg" } });
    await wrapper.setProps({ album: "second.jpg" });
    first.resolve();
    await flushPromises();
    paint();
    paint();
    expect(wrapper.emitted("ready")).toBeUndefined();
    second.resolve();
    await flushPromises();
    paint();
    expect(wrapper.emitted("ready")).toBeUndefined();
    paint();
    expect(wrapper.emitted("ready")).toHaveLength(1);
    expect(renderer.setAlbum).toHaveBeenLastCalledWith("second.jpg", false);
    wrapper.unmount();
    expect(frames.size).toBe(0);
    expect(renderer.pause).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("cancels a scheduled ready frame when the track changes", async () => {
    const next = pendingAlbum();
    const renderer = rendererFixture();
    renderer.setAlbum.mockResolvedValueOnce(undefined).mockReturnValueOnce(next.promise);
    createRenderer.mockReturnValue(renderer);
    const wrapper = mount(BackgroundRender, { props: { album: "first.jpg" } });
    await flushPromises();
    paint();
    await wrapper.setProps({ album: "next.jpg" });
    paint();
    expect(wrapper.emitted("ready")).toBeUndefined();
    next.resolve();
    await flushPromises();
    paint();
    paint();
    expect(wrapper.emitted("ready")).toHaveLength(1);
    wrapper.unmount();
  });

  it("ignores a disposed renderer's cover completion after an engine switch", async () => {
    const oldAlbum = pendingAlbum();
    const oldRenderer = rendererFixture();
    oldRenderer.setAlbum.mockReturnValue(oldAlbum.promise);
    const newRenderer = rendererFixture();
    createRenderer.mockReturnValueOnce(oldRenderer).mockReturnValueOnce(newRenderer);
    const wrapper = mount(BackgroundRender, { props: { album: "cover.jpg" } });
    await wrapper.setProps({ renderEngine: "isolation" });
    oldAlbum.resolve();
    await flushPromises();
    paint();
    paint();
    expect(wrapper.emitted("ready")).toHaveLength(1);
    expect(oldRenderer.dispose).toHaveBeenCalledOnce();
    expect(newRenderer.setAlbum).toHaveBeenCalledWith("cover.jpg", false);
    wrapper.unmount();
  });

  it("cancels readiness frames and releases FFT when the player closes", async () => {
    createRenderer.mockReturnValue(rendererFixture());
    const wrapper = mount(BackgroundRender, {
      props: { album: "cover.jpg", playing: true, enableBeat: true },
    });
    await flushPromises();
    expect(acquireFft).toHaveBeenCalledOnce();
    wrapper.unmount();
    paint();
    paint();
    expect(wrapper.emitted("ready")).toBeUndefined();
    expect(frames.size).toBe(0);
    expect(releaseFft).toHaveBeenCalledOnce();
  });

  it("does not schedule readiness after an unmounted cover finishes loading", async () => {
    const album = pendingAlbum();
    const renderer = rendererFixture();
    renderer.setAlbum.mockReturnValue(album.promise);
    createRenderer.mockReturnValue(renderer);
    const wrapper = mount(BackgroundRender, { props: { album: "cover.jpg" } });
    wrapper.unmount();
    album.resolve();
    await flushPromises();
    expect(frames.size).toBe(0);
    expect(wrapper.emitted("ready")).toBeUndefined();
  });
});
