<script setup lang="ts">
import { useLibraryStore } from "@/stores/library";
import { useStreamingStore } from "@/stores/streaming";
import { usePageSearch } from "@/composables/usePageSearch";
import { getTrackYear, trackYears } from "@shared/utils/year";
import { matchesSearch } from "@/utils/search/match";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const library = useLibraryStore();
const streaming = useStreamingStore();
const filter = usePageSearch();
const error = ref(false);
const selected = computed(() => (route.name === "year" ? Number(route.params.year) : undefined));
const tracks = computed(() => [...library.tracks, ...streaming.songs]);
const years = computed(() =>
  trackYears(tracks.value)
    .reverse()
    .filter((year) => matchesSearch(filter.value, String(year))),
);
const songs = computed(() =>
  tracks.value.filter((track) => getTrackYear(track) === selected.value),
);

/** Load authoritative local and active-server indexes without scanning from this page. */
const load = async (): Promise<void> => {
  const results = await Promise.allSettled([
    library.initialized ? Promise.resolve() : library.load(),
    streaming.init(),
  ]);
  error.value = results.some((result) => result.status === "rejected");
};
onMounted(load);
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-5 p-5">
    <h1
      v-if="selected !== undefined"
      class="shrink-0 py-6 text-center text-7xl font-bold tabular-nums"
    >
      {{ route.params.year }}
    </h1>
    <h1 v-else class="text-3xl font-bold">{{ t("year.label") }}</h1>
    <p v-if="error" role="alert" class="text-error">{{ t("common.error") }}</p>
    <div
      v-if="selected === undefined"
      class="flex flex-1 min-h-0 flex-col items-start gap-4 overflow-y-auto"
    >
      <button
        v-for="year in years"
        :key="year"
        class="text-xl tabular-nums hover:underline focus-visible:underline"
        @click="router.push({ name: 'year', params: { year } })"
      >
        {{ year }}
      </button>
      <p v-if="!years.length" class="text-on-surface-variant/60">{{ t("search.noResults") }}</p>
    </div>
    <div v-else class="min-h-0 flex-1">
      <SongList
        :items="songs"
        :search-query="filter"
        enable-sort
        sort-key="years"
        :playback-context="{
          originType: 'page',
          originId: `year:${selected}`,
          originName: String(selected),
        }"
      />
    </div>
  </section>
</template>
