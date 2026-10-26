import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { flushPromises } from "@vue/test-utils";
import {
  captureCover,
  coverTransitionActive,
  getCoverPreview,
  installCoverTransitions,
} from "./coverTransition";

const path = "/collection/streaming/album/album-1?serverId=server-a";
const album = { id: "album-1", title: "Test album", cover: "cover://album.jpg", trackCount: 12 };
let dispose: (() => void) | undefined;

/**
 * Exercise real navigation with controllable snapshot callbacks.
 * @returns Router, content container, and native transition stub.
 */
const setupNavigation = async () => {
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 160, 160),
  );
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
  const scope = document.createElement("main");
  document.body.append(scope);
  const start = vi.fn((update: ViewTransitionUpdateCallback) => {
    const completed = Promise.withResolvers<void>();
    const ready = Promise.resolve().then(update);
    return { ready, finished: completed.promise, skipTransition: completed.resolve };
  });
  Object.assign(document, { startViewTransition: start });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "list", component: {} },
      { path: "/ordinary", component: {} },
      { path: "/collection/:source/:type/:id", name: "collection", component: {} },
      { path: "/artist/:source/:id", name: "artist", component: {} },
    ],
  });
  router.afterEach((to, _from, failure) => {
    if (!failure) {
      scope.innerHTML =
        to.name === "collection" || to.name === "artist"
          ? "<div data-cover-hero><img data-cover-image></div>"
          : '<div data-cover-key="cover"><img data-cover-image></div>';
    }
  });
  await router.push("/");
  dispose = installCoverTransitions(router, () => scope, vi.fn());
  return { router, scope, start };
};

afterEach(async () => {
  dispose?.();
  dispose = undefined;
  await flushPromises();
  Reflect.deleteProperty(document, "startViewTransition");
  document.documentElement.removeAttribute("data-player-transition");
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("shared cover navigation", () => {
  it("matches quoted media IDs without interpreting selector syntax", async () => {
    const { router, scope, start } = await setupNavigation();
    const key = 'default:an "album" [special]';
    scope.querySelector<HTMLElement>("[data-cover-key]")!.dataset.coverKey = key;
    captureCover(album, key);
    await router.push(path);
    await flushPromises();
    expect(start).toHaveBeenCalledOnce();
    expect(scope.querySelector("[data-cover-hero][data-cover-shared]")).not.toBeNull();
  });

  it("does not decode a destination image that is still downloading", async () => {
    const { router, scope } = await setupNavigation();
    router.afterEach(() => {
      const image = scope.querySelector("[data-cover-hero] img");
      if (image) Object.defineProperty(image, "complete", { value: false });
    });
    captureCover(album, "cover");
    await router.push(path);
    await flushPromises();
    expect(HTMLImageElement.prototype.decode).not.toHaveBeenCalled();
  });

  it.each([path, "/artist/streaming/artist-1?serverId=server-a"])(
    "%s matches entry and return navigation and cleans up after completion",
    async (target) => {
      const { router, scope, start } = await setupNavigation();
      scope.querySelector<HTMLElement>("[data-cover-key]")!.style.borderRadius = "12px";
      captureCover(album, "cover");
      await router.push(target);
      await flushPromises();
      expect(getCoverPreview(target)?.title).toBe(album.title);
      expect(coverTransitionActive.value).toBe(true);
      expect(document.documentElement.dataset.coverTransition).toBe("enter");
      expect(document.documentElement.style.getPropertyValue("--cover-transition-radius")).toBe(
        "12px",
      );
      expect(scope.querySelector("[data-cover-hero][data-cover-shared]")).not.toBeNull();
      start.mock.results[0].value.skipTransition();
      await flushPromises();
      expect(coverTransitionActive.value).toBe(false);
      expect(scope.querySelector("[data-cover-shared]")).toBeNull();
      expect(document.documentElement.hasAttribute("data-cover-transition")).toBe(false);
      expect(document.documentElement.style.getPropertyValue("--cover-transition-radius")).toBe("");
      await router.push("/");
      await flushPromises();
      expect(start).toHaveBeenCalledTimes(2);
      expect(document.documentElement.dataset.coverTransition).toBe("back");
      expect(
        scope.querySelector('[data-cover-key="cover"]')!.hasAttribute("data-cover-shared"),
      ).toBe(true);
      start.mock.results[1].value.skipTransition();
      await flushPromises();
      await router.push(target.replace("server-a", "server-b"));
      await router.push("/");
      expect(start).toHaveBeenCalledTimes(2);
    },
  );

  it("does not start a cover transition while Now Playing is transitioning", async () => {
    const { router, start } = await setupNavigation();
    document.documentElement.setAttribute("data-player-transition", "expand");
    captureCover(album, "cover");
    await router.push(path);
    expect(start).not.toHaveBeenCalled();
    expect(coverTransitionActive.value).toBe(false);
    expect(document.documentElement.hasAttribute("data-cover-transition")).toBe(false);
  });

  it("ordinary navigation neither transitions nor leaves a stale preview", async () => {
    const { router, start } = await setupNavigation();
    captureCover(album, "cover");
    await router.push("/ordinary");
    await router.push(path);
    expect(start).not.toHaveBeenCalled();
    expect(coverTransitionActive.value).toBe(false);
    expect(getCoverPreview(path)).toBeNull();
  });

  it.each(["transitions disabled", "native API unavailable"])(
    "%s uses ordinary navigation",
    async (condition) => {
      const { router, start } = await setupNavigation();
      if (condition === "transitions disabled") {
        dispose?.();
        dispose = undefined;
      } else Object.assign(document, { startViewTransition: undefined });
      const timer = vi.spyOn(window, "setTimeout");
      captureCover(album, "cover");
      if (condition === "transitions disabled") expect(timer).not.toHaveBeenCalled();
      await router.push(path);
      expect(start).not.toHaveBeenCalled();
      expect(coverTransitionActive.value).toBe(false);
      expect(getCoverPreview(path)).toBeNull();
    },
  );

  it("a cancelled snapshot cannot prematurely commit the next navigation", async () => {
    const { router, start } = await setupNavigation();
    const updates: ViewTransitionUpdateCallback[] = [];
    start.mockImplementation((update) => {
      updates.push(update);
      const completed = Promise.withResolvers<void>();
      return {
        ready: Promise.resolve(),
        finished: completed.promise,
        skipTransition: completed.resolve,
      };
    });
    captureCover(album, "cover");
    const first = router.push(path);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    captureCover({ ...album, title: "Another album" }, "cover");
    const nextPath = path.replace("album-1", "album-2");
    const second = router.push(nextPath);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
    await updates[0]();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/");
    const updating = updates[1]();
    await Promise.all([first, second, updating]);
    expect(router.currentRoute.value.fullPath).toBe(nextPath);
    expect(getCoverPreview(nextPath)?.title).toBe("Another album");
    await router.push("/ordinary");
    expect(coverTransitionActive.value).toBe(false);
    expect(start).toHaveBeenCalledTimes(2);
  });
});
