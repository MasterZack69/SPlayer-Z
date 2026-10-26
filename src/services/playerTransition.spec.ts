import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { coverTransitionActive } from "./coverTransition";
import {
  cancelPlayerTransition,
  fullPlayerReady,
  playerTransition,
  setPlayerExpanded,
} from "./playerTransition";

vi.mock("@/stores/status", () => ({ useStatusStore: () => status }));
vi.mock("@/stores/settings", () => ({ useSettingsStore: () => settings }));
const status = reactive({ isPlayerExpanded: false });
const settings = reactive({ appearance: { seamlessTransition: true }, reducedMotion: false });
let transitions: Array<{
  update: ViewTransitionUpdateCallback;
  ready: ReturnType<typeof Promise.withResolvers<void>>;
  done: ReturnType<typeof Promise.withResolvers<void>>;
  skipTransition: ReturnType<typeof vi.fn>;
}>;
let start: ReturnType<typeof vi.fn>;

/** Create loaded bar/full covers without involving network artwork. */
const mountCovers = (): void => {
  document.body.innerHTML = `
    <div data-player-cover="bar"><img data-cover-image src="thumb.jpg"></div>
    <div data-player-cover="full"><img src="thumb.jpg"></div>`;
};

/** Run the browser's deferred snapshot update callback.
 * @param index - Transition created by the corresponding navigation.
 */
const updateSnapshot = async (index = 0): Promise<void> => {
  await transitions[index].update();
  transitions[index].ready.resolve();
  await flushPromises();
};

beforeEach(() => {
  status.isPlayerExpanded = false;
  settings.appearance.seamlessTransition = true;
  settings.reducedMotion = false;
  fullPlayerReady.value = true;
  coverTransitionActive.value = false;
  transitions = [];
  mountCovers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
  vi.spyOn(HTMLElement.prototype, "checkVisibility").mockReturnValue(true);
  start = vi.fn((update: ViewTransitionUpdateCallback) => {
    const ready = Promise.withResolvers<void>();
    const done = Promise.withResolvers<void>();
    const skipTransition = vi.fn(() => done.resolve());
    transitions.push({ update, ready, done, skipTransition });
    return { ready: ready.promise, finished: done.promise, skipTransition };
  });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
});

afterEach(async () => {
  cancelPlayerTransition();
  await flushPromises();
  fullPlayerReady.value = false;
  coverTransitionActive.value = false;
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "startViewTransition");
  vi.restoreAllMocks();
});

describe("Now Playing cover transitions", () => {
  it("matches bar/full covers on open and close and releases snapshot markers", async () => {
    setPlayerExpanded(true);
    expect(document.documentElement.dataset.playerTransition).toBe("expand");
    expect(status.isPlayerExpanded).toBe(false);
    expect(
      document.querySelector('[data-player-cover="bar"]')?.hasAttribute("data-player-shared"),
    ).toBe(true);
    await updateSnapshot();
    expect(status.isPlayerExpanded).toBe(true);
    expect(
      document.querySelector('[data-player-cover="full"]')?.hasAttribute("data-player-shared"),
    ).toBe(true);
    transitions[0].done.resolve();
    await flushPromises();
    expect(playerTransition.value).toBeNull();
    expect(document.querySelector("[data-player-shared]")).toBeNull();
    expect(document.documentElement.hasAttribute("data-player-transition")).toBe(false);
    setPlayerExpanded(false);
    expect(document.documentElement.dataset.playerTransition).toBe("collapse");
    await updateSnapshot(1);
    expect(status.isPlayerExpanded).toBe(false);
    expect(
      document.querySelector('[data-player-cover="bar"]')?.hasAttribute("data-player-shared"),
    ).toBe(true);
  });

  it.each([
    "disabled",
    "reduced motion",
    "hidden",
    "no API",
    "detail transition",
    "unloaded image",
    "invisible cover",
    "missing cover",
  ])("%s uses ordinary player expansion", async (condition) => {
    if (condition === "disabled") settings.appearance.seamlessTransition = false;
    if (condition === "reduced motion") settings.reducedMotion = true;
    if (condition === "hidden") vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    if (condition === "no API") Reflect.deleteProperty(document, "startViewTransition");
    if (condition === "detail transition") coverTransitionActive.value = true;
    if (condition === "unloaded image")
      vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
    if (condition === "invisible cover")
      vi.spyOn(HTMLElement.prototype, "checkVisibility").mockReturnValue(false);
    if (condition === "missing cover") document.body.innerHTML = "";
    setPlayerExpanded(true);
    expect(status.isPlayerExpanded).toBe(true);
    expect(start).not.toHaveBeenCalled();
    expect(playerTransition.value).toBeNull();
  });

  it("cancels before the old callback can expand the player", async () => {
    setPlayerExpanded(true);
    setPlayerExpanded(false);
    await updateSnapshot();
    expect(status.isPlayerExpanded).toBe(false);
    expect(playerTransition.value).toBeNull();
    expect(document.querySelector("[data-player-shared]")).toBeNull();
  });

  it("cancellation releases the wait for a lazy player mount", async () => {
    fullPlayerReady.value = false;
    setPlayerExpanded(true);
    const pending = transitions[0].update();
    expect(status.isPlayerExpanded).toBe(true);
    cancelPlayerTransition();
    await pending;
    expect(document.querySelector("[data-player-shared]")).toBeNull();
  });

  it("an old completion cannot remove a newer transition's markers", async () => {
    setPlayerExpanded(true);
    await updateSnapshot();
    setPlayerExpanded(false);
    expect(document.documentElement.dataset.playerTransition).toBe("collapse");
    await updateSnapshot(1);
    expect(playerTransition.value).not.toBeNull();
    expect(
      document.querySelector('[data-player-cover="bar"]')?.hasAttribute("data-player-shared"),
    ).toBe(true);
    transitions[1].done.resolve();
    await flushPromises();
    expect(playerTransition.value).toBeNull();
  });

  it("does not wait for unfinished full-resolution artwork", async () => {
    setPlayerExpanded(true);
    const image = document.querySelector<HTMLImageElement>('[data-player-cover="full"] img')!;
    image.src = "slow-full-resolution.jpg";
    Object.defineProperty(image, "complete", { value: false });
    await updateSnapshot();
    expect(status.isPlayerExpanded).toBe(true);
    expect(image.decode).not.toHaveBeenCalled();
  });

  it("releases markers even when the browser rejects snapshot completion", async () => {
    setPlayerExpanded(true);
    transitions[0].ready.reject(new Error("snapshot cancelled"));
    transitions[0].done.reject(new Error("snapshot cancelled"));
    await flushPromises();
    expect(playerTransition.value).toBeNull();
    expect(document.querySelector("[data-player-shared]")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--player-cover-from-radius")).toBe("");
  });
});
