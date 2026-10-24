/** Keep year-wheel navigation in memory for the lifetime of this app session. */
export const useYearBrowserStore = defineStore("yearBrowser", () => {
  const selectedId = ref("");
  return { selectedId };
});
