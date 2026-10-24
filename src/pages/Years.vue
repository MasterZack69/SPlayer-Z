<script setup lang="ts">
import { useLibraryStore } from "@/stores/library";
import { useStreamingStore } from "@/stores/streaming";
import YearWheel from "@/components/list/YearWheel.vue";
import { useBrowseSortStore } from "@/stores/browseSort";
import { useYearBrowserStore } from "@/stores/yearBrowser";
import { useSettingsStore } from "@/stores/settings";
import { usePageSearch } from "@/composables/usePageSearch";
import { getTrackYear, trackYears } from "@shared/utils/year";
import { formatTime } from "@/utils/time";
import type { SSelectOption } from "@/components/ui/SSelect.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const library = useLibraryStore();
const settings = useSettingsStore();
const streaming = useStreamingStore();
const filter = usePageSearch();
const error = ref(false);
const browser = useYearBrowserStore();
const { yearOrder: sortOrder } = storeToRefs(useBrowseSortStore());
const sortOptions = computed<SSelectOption[]>(() => [
  { value: "asc", label: t("songList.sort.asc") },
  { value: "desc", label: t("songList.sort.desc") },
]);
const isDetail = computed(() => route.name === "year");

const tracks = computed(() => [...library.tracks, ...streaming.songs]);
const years = computed(() => {
  const ordered = trackYears(tracks.value);
  if (sortOrder.value === "desc") ordered.reverse();
  const entries = ordered.map((year) => ({ id: String(year), label: String(year) }));
  if (tracks.value.some((track) => getTrackYear(track) === undefined))
    entries.push({ id: "unknown", label: t("year.unknown") });
  return entries;
});
const selectedId = computed(() => {
  if (isDetail.value) return String(route.params.year);
  return years.value.some((entry) => entry.id === browser.selectedId)
    ? browser.selectedId
    : (years.value[0]?.id ?? "");
});
watch(
  selectedId,
  (id) => {
    if (id) browser.selectedId = id;
  },
  { immediate: true },
);
const heading = computed(() =>
  selectedId.value === "unknown" ? t("year.unknown") : selectedId.value,
);
const songs = computed(() => {
  if (!selectedId.value) return [];
  const year = selectedId.value === "unknown" ? undefined : Number(selectedId.value);
  return tracks.value.filter((track) => getTrackYear(track) === year);
});

/** Update the selected year in place and keep browser history meaningful.
 * @param id - Numeric year or the unknown-year identifier.
 */
const selectYear = (id: string): void => {
  if (isDetail.value && selectedId.value === id) return;
  void router.push({ name: "year", params: { year: id }, query: route.query });
};

const totalDuration = computed(() =>
  formatTime(songs.value.reduce((sum, track) => sum + track.duration, 0)),
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
  <section class="years-browser flex h-full min-h-0 flex-col gap-4 p-5">
    <h1 class="shrink-0 text-3xl font-bold">{{ t("year.label") }}</h1>
    <p v-if="error" role="alert" class="text-error">{{ t("common.error") }}</p>
    <div class="years-panes min-h-0 flex-1">
      <aside class="year-navigation flex min-h-0 flex-col gap-4" :aria-label="t('year.label')">
        <div
          role="group"
          :aria-label="t('songList.sort.mode')"
          class="year-sort-control relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-2 text-sm text-on-surface-variant/70"
        >
          <IconLucideArrowUpDown class="size-3.5 shrink-0" />
          <span>{{ t("songList.sort.mode") }}</span>
          <div class="w-full max-w-40">
            <SSelect v-model="sortOrder" :options="sortOptions" />
          </div>
        </div>
        <YearWheel
          :items="years"
          :selected="selectedId"
          :label="t('year.label')"
          :reduced-motion="settings.reducedMotion"
          class="min-h-0 flex-1"
          @select="selectYear"
        />
        <p v-if="!years.length" class="text-center text-sm text-on-surface-variant/60">
          {{ t("search.noResults") }}
        </p>
      </aside>
      <div class="flex min-h-0 min-w-0 flex-col">
        <header class="shrink-0 pb-4" data-year-summary>
          <h2 class="sr-only">{{ heading }}</h2>
          <div
            class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-on-surface-variant/70"
          >
            <span class="flex items-center gap-1.5">
              <IconLucideListMusic class="size-3.5 shrink-0" />
              {{ t("common.totalSongs", { count: songs.length }) }}
            </span>
            <span class="flex items-center gap-1.5">
              <IconLucideHourglass class="size-3.5 shrink-0" />
              {{ t("collection.totalDuration", { time: totalDuration }) }}
            </span>
          </div>
        </header>
        <div
          :key="selectedId"
          class="year-song-pane min-h-0 flex-1 pt-3"
          :class="{ 'motion-disabled': settings.reducedMotion }"
        >
          <SongList
            :items="songs"
            :search-query="filter"
            enable-sort
            sort-key="years"
            :playback-context="{
              originType: 'page',
              originId: `year:${selectedId}`,
              originName: heading,
            }"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.years-panes {
  display: grid;
  grid-template-columns: clamp(180px, 22%, 260px) minmax(0, 1fr);
  gap: 20px;
  overflow: hidden;
}
.year-sort-control :deep([role="combobox"]) {
  min-height: 44px;
}
.year-song-pane {
  animation: year-pane-in 180ms ease-out;
}
.year-song-pane.motion-disabled {
  animation: none;
}
@keyframes year-pane-in {
  from {
    opacity: 0.65;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 640px) {
  .years-browser {
    padding: 12px;
  }
  .years-panes {
    grid-template-columns: 104px minmax(0, 1fr);
    gap: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .year-song-pane {
    animation: none;
  }
}
</style>
