<script setup lang="ts">
defineOptions({ name: "SearchPage" });
import type { CoverItem } from "@/types/artist";
import { useLibraryStore } from "@/stores/library";
import { usePlaylistStore } from "@/stores/playlist";
import { useStreamingStore } from "@/stores/streaming";
import { navigateToResource } from "@/utils/navigate";
import {
  buildSearchIndex,
  searchIndex,
  ENTITY_CATEGORIES,
  type SearchCategory,
} from "@/utils/search/global";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const library = useLibraryStore();
const playlists = usePlaylistStore();
const streaming = useStreamingStore();
const loading = ref(true);
const error = ref("");
const keyword = computed(() => (typeof route.query.q === "string" ? route.query.q.trim() : ""));
const categories: SearchCategory[] = ["all", "songs", ...ENTITY_CATEGORIES];
const category = computed<SearchCategory>(() =>
  categories.includes(route.query.category as SearchCategory)
    ? (route.query.category as SearchCategory)
    : "all",
);
const index = computed(() =>
  buildSearchIndex({
    tracks: library.tracks,
    folders: library.folderTree,
    playlists: playlists.playlists,
    server: {
      id: streaming.activeServerId ?? undefined,
      songs: streaming.songs,
      albums: streaming.albums,
      artists: streaming.artists,
      playlists: streaming.playlists,
    },
  }),
);
const results = computed(() =>
  searchIndex(
    index.value,
    keyword.value,
    typeof route.query.genre === "string" ? route.query.genre : undefined,
  ),
);
const total = computed(
  () =>
    results.value.songs.length +
    ENTITY_CATEGORIES.reduce((sum, key) => sum + results.value[key].length, 0),
);
const entityResults = computed(() =>
  category.value !== "all" && category.value !== "songs" ? results.value[category.value] : [],
);
const tabs = computed(() =>
  categories.map((key) => ({
    key,
    label: `${t(`search.tabs.${key}`)} (${key === "all" ? total.value : results.value[key].length})`,
  })),
);
const selectedCount = computed(() =>
  category.value === "all" ? total.value : results.value[category.value].length,
);
const groups = computed(() => ENTITY_CATEGORIES.filter((key) => results.value[key].length > 0));

/**
 * Switch categories without discarding the submitted query.
 * @param key - Selected result category.
 */
const selectCategory = (key: string): void => {
  void router.replace({ query: { ...route.query, category: key } });
};

/**
 * Open the original resource while preserving its source and server identity.
 * @param item - Selected result card.
 */
const openEntity = (item: CoverItem): void => {
  const entity = ENTITY_CATEGORIES.map((key) =>
    results.value[key].find((entry) => entry.id === item.id),
  ).find(Boolean);
  if (!entity) return;
  if (entity.category === "years") {
    void router.push({ name: "year", params: { year: entity.resourceId } });
  } else if (entity.category === "folders") {
    void router.push({ name: "folders", query: { path: entity.resourceId } });
  } else if (entity.category === "genres") {
    void router.push({
      name: "search",
      query: { q: entity.title, genre: entity.title, category: "songs" },
    });
  } else {
    const type = ({ albums: "album", artists: "artist", playlists: "playlist" } as const)[
      entity.category
    ];
    navigateToResource({
      type,
      source: entity.source,
      id: entity.resourceId,
      name: entity.title,
      serverId: entity.serverId,
    });
  }
};

/** Load existing local indexes once; searches themselves never call public music APIs. */
const load = async (): Promise<void> => {
  loading.value = true;
  error.value = "";
  const outcomes = await Promise.allSettled([
    library.initialized ? Promise.resolve() : library.load(),
    playlists.initialized ? Promise.resolve() : playlists.load(),
    streaming.init(),
  ]);
  if (outcomes.some((outcome) => outcome.status === "rejected"))
    error.value = t("search.partialError");
  loading.value = false;
};
onMounted(load);
</script>

<template>
  <div class="h-full flex flex-col min-h-0 gap-4 p-5">
    <header class="shrink-0">
      <h1 class="text-2xl font-bold">
        {{ keyword ? `${t("search.title")}: ${keyword}` : t("search.title") }}
      </h1>
      <p class="mt-1 text-sm text-on-surface-variant/60">{{ t("search.globalHint") }}</p>
    </header>
    <p v-if="error" role="alert" class="text-error text-sm">
      {{ error }}
      <button type="button" class="underline" @click="load">{{ t("common.retry") }}</button>
    </p>
    <p v-if="!keyword" class="text-on-surface-variant/60">{{ t("search.emptyKeyword") }}</p>
    <template v-else>
      <div class="shrink-0 overflow-x-auto">
        <STabs :model-value="category" :tabs="tabs" @update:model-value="selectCategory" />
      </div>
      <p
        v-if="loading || streaming.loading"
        role="status"
        class="text-sm text-on-surface-variant/60"
      >
        {{ t("common.loading") }}
      </p>
      <p v-if="!loading && !streaming.loading && !selectedCount" class="text-on-surface-variant/60">
        {{ t("search.noResults") }}
      </p>
      <div v-if="category === 'all'" class="flex-1 min-h-0 overflow-y-auto space-y-6 pb-6">
        <section v-if="results.songs.length">
          <div class="flex justify-between items-center mb-3 gap-3">
            <h2 class="text-lg font-semibold">
              {{ t("search.tabs.songs") }} ({{ results.songs.length }})
            </h2>
            <SButton variant="text" @click="selectCategory('songs')">
              {{ t("search.showAll") }}
            </SButton>
          </div>
          <div :style="{ height: `${Math.min(results.songs.length, 5) * 88 + 48}px` }">
            <SongList :items="results.songs.slice(0, 5)" />
          </div>
        </section>
        <section v-for="group in groups" :key="group">
          <div class="flex justify-between items-center mb-3 gap-3">
            <h2 class="text-lg font-semibold">
              {{ t(`search.tabs.${group}`) }} ({{ results[group].length }})
            </h2>
            <SButton variant="text" @click="selectCategory(group)">
              {{ t("search.showAll") }}
            </SButton>
          </div>
          <div v-if="group === 'years'" class="flex flex-col items-start gap-3">
            <button
              v-for="item in results.years.slice(0, 6)"
              :key="item.id"
              class="appearance-none border-none bg-transparent p-0 text-left text-on-surface cursor-pointer hover:underline focus-visible:underline"
              @click="openEntity(item)"
            >
              {{ item.title }}
            </button>
          </div>
          <CoverList
            v-else
            :items="results[group].slice(0, 6)"
            :virtual="false"
            :type="group === 'artists' ? 'artist' : 'default'"
            @click="openEntity"
          />
        </section>
      </div>
      <div v-else-if="category === 'songs'" class="flex-1 min-h-0">
        <SongList :items="results.songs" />
      </div>
      <div v-else class="flex-1 min-h-0">
        <div
          v-if="category === 'years'"
          class="scrollbar-hidden flex flex-col items-start gap-3 overflow-y-auto h-full"
        >
          <button
            v-for="item in entityResults"
            :key="item.id"
            class="appearance-none border-none bg-transparent p-0 text-left text-on-surface cursor-pointer hover:underline focus-visible:underline"
            @click="openEntity(item)"
          >
            {{ item.title }}
          </button>
        </div>
        <CoverList
          v-else
          :items="entityResults"
          :type="category === 'artists' ? 'artist' : 'default'"
          @click="openEntity"
        />
      </div>
    </template>
  </div>
</template>
