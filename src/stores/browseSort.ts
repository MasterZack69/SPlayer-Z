import type { BrowseSortMode, BrowseSortKey, SortOrder } from "@/types/list";

/** Save independent browser sort modes across app launches, not navigation selections. */
export const useBrowseSortStore = defineStore(
  "browseSort",
  () => {
    const yearOrder = ref<SortOrder>("desc");
    const collectionModes = ref<Record<BrowseSortKey, BrowseSortMode>>({
      artist: "default",
      album: "default",
      genre: "default",
    });
    return { yearOrder, collectionModes };
  },
  { persist: true },
);
