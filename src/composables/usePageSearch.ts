import type { ComputedRef } from "vue";

/**
 * Read the current page's filter from the URL so navigation and clearing stay synchronized.
 * @returns Reactive text used only by the current page's content.
 */
export const usePageSearch = (): ComputedRef<string> => {
  const route = useRoute();
  return computed(() => (typeof route.query.filter === "string" ? route.query.filter : ""));
};
