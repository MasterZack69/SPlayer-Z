import type { Router, RouteLocationNormalized } from "vue-router";
import type { CoverItem } from "@/types/artist";

type CoverPreview = Pick<CoverItem, "title" | "cover" | "trackCount">;
/** Reuse the document signature until DOM types include scoped view transitions. */
type TransitionScope = HTMLElement & Partial<Pick<Document, "startViewTransition">>;

/** Keep one navigation header, not track collections or page DOM. */
interface CoverNavigation {
  coverKey: string;
  header: CoverPreview;
  listPath: string;
  detailPath: string;
}

let pendingCover: Pick<CoverNavigation, "coverKey" | "header"> | null = null;
let preview: CoverNavigation | null = null;
let captureEnabled = false;

export const coverTransitionActive = shallowRef(false);

/**
 * Find a remounted card by its stable media identity.
 * The route and main-content scope distinguish pages and media servers.
 * @param scope - Main-content container.
 * @param key - Stable identity declared by the card.
 * @returns Matching cover in the current view.
 */
const findCover = (scope: HTMLElement, key: string): HTMLElement | null =>
  [...scope.querySelectorAll<HTMLElement>("[data-cover-key]")].find(
    (element) => element.dataset.coverKey === key,
  ) ?? null;

/**
 * Capture the header only for detail navigation initiated by this click.
 * @param item - Lightweight card header.
 * @param coverKey - Stable media identity, not a component instance ID.
 */
export const captureCover = (item: CoverItem, coverKey: string): void => {
  if (!captureEnabled || !item.cover) return;
  const captured = {
    coverKey,
    header: {
      title: item.title,
      cover: item.cover,
      trackCount: item.trackCount,
    },
  };
  pendingCover = captured;
  window.setTimeout(() => {
    if (pendingCover === captured) pendingCover = null;
  }, 0);
};

/**
 * Read the matching header without waiting for track details.
 * @param path - Full detail route including the media server.
 * @returns Header matching the current navigation.
 */
export const getCoverPreview = (path: string): CoverPreview | null =>
  preview?.detailPath === path ? preview.header : null;

/**
 * Limit cover snapshots to main content and leave ordinary navigation unchanged.
 * @param router - Application router.
 * @param getScope - Main-content container.
 * @param restoreScroll - Restore scrolling after the destination mounts.
 * @returns Disposer for guards and active snapshots.
 */
export const installCoverTransitions = (
  router: Router,
  getScope: () => TransitionScope | null,
  restoreScroll: () => void,
): (() => void) => {
  captureEnabled = true;
  let returnNavigation: CoverNavigation | null = null;
  let navigation: CoverNavigation | null = null;
  let targetRoute: RouteLocationNormalized | null = null;
  let transition: ViewTransition | null = null;
  let finishUpdate: (() => void) | null = null;
  let releaseNavigation: (() => void) | null = null;
  let covers: HTMLElement[] = [];

  /** Release snapshots and transient styles during completion or cancellation. */
  const cleanup = (): void => {
    transition?.skipTransition();
    transition = null;
    finishUpdate?.();
    finishUpdate = null;
    releaseNavigation?.();
    releaseNavigation = null;
    for (const cover of covers) cover.removeAttribute("data-cover-shared");
    getScope()?.style.removeProperty("--cover-transition-radius");
    covers = [];
    preview = null;
    coverTransitionActive.value = false;
  };

  const removeBeforeEach = router.beforeEach((to, from) => {
    cleanup();
    navigation = null;
    targetRoute = to;
    const captured = pendingCover;
    pendingCover = null;
    if ((to.name === "collection" || to.name === "artist") && captured) {
      navigation = { ...captured, listPath: from.fullPath, detailPath: to.fullPath };
    } else if (
      returnNavigation &&
      ((from.fullPath === returnNavigation.detailPath &&
        to.fullPath === returnNavigation.listPath) ||
        (from.fullPath === returnNavigation.listPath &&
          to.fullPath === returnNavigation.detailPath))
    ) {
      navigation = returnNavigation;
    }
  });

  const removeBeforeResolve = router.beforeResolve(async (to) => {
    const current = navigation;
    const scope = getScope();
    if (to !== targetRoute || !current || !scope?.startViewTransition || document.hidden) {
      return;
    }

    const entering = to.fullPath === current.detailPath;
    const cover = entering
      ? findCover(scope, current.coverKey)
      : scope.querySelector<HTMLElement>("[data-cover-hero]");
    const image = cover?.querySelector<HTMLImageElement>("img[data-cover-image]");
    if (!cover || !scope.contains(cover) || !image?.complete || !image.naturalWidth) return;

    covers.push(cover);
    cover.setAttribute("data-cover-shared", "");
    scope.style.setProperty("--cover-transition-radius", getComputedStyle(cover).borderRadius);
    if (entering) preview = current;
    coverTransitionActive.value = true;

    const committed = Promise.withResolvers<void>();
    const { promise: started, resolve: release } = Promise.withResolvers<void>();
    finishUpdate = committed.resolve;
    releaseNavigation = release;
    const active = scope.startViewTransition(async () => {
      release();
      if (releaseNavigation === release) releaseNavigation = null;
      await committed.promise;
    });
    transition = active;
    // Skipping rejects ready; finished still releases the snapshot.
    void active.ready.catch(() => {});
    void active.finished
      .finally(() => {
        if (transition === active) cleanup();
      })
      .catch(() => {});
    await started;
  });

  const removeAfterEach = router.afterEach(async (to, _from, failure) => {
    if (to !== targetRoute) return;
    const current = navigation;
    const active = transition;
    if (failure) {
      cleanup();
      return;
    }
    if (!current || !active) return;
    if (to.fullPath === current.detailPath) returnNavigation = current;

    await nextTick();
    restoreScroll();
    // Cached virtual lists restore their scroll position on the next tick.
    await nextTick();
    if (transition !== active) return;
    const scope = getScope();
    const entering = to.fullPath === current.detailPath;
    const cover = entering
      ? scope?.querySelector<HTMLElement>("[data-cover-hero]")
      : scope
        ? findCover(scope, current.coverKey)
        : null;
    if (cover && scope?.contains(cover)) {
      const bounds = cover.getBoundingClientRect();
      const viewport = scope.getBoundingClientRect();
      if (bounds.bottom > viewport.top && bounds.top < viewport.bottom && bounds.width > 0) {
        const image = cover.querySelector<HTMLImageElement>("img[data-cover-image]");
        // Never hold a navigation snapshot waiting for a network image.
        if (image?.complete && image.naturalWidth > 0) {
          await image.decode().catch(() => {});
          if (transition === active && image.naturalWidth > 0) {
            covers.push(cover);
            cover.setAttribute("data-cover-shared", "");
          }
        }
      }
    }
    if (transition === active) {
      finishUpdate?.();
      finishUpdate = null;
    }
  });

  const removeError = router.onError((_error, to) => {
    if (to === targetRoute) cleanup();
  });
  return () => {
    captureEnabled = false;
    removeBeforeEach();
    removeBeforeResolve();
    removeAfterEach();
    removeError();
    cleanup();
    pendingCover = null;
    returnNavigation = null;
  };
};
