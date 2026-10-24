<script setup lang="ts">
import { useBrowseSortStore } from "@/stores/browseSort";
import type { BrowseSortKey, BrowseSortMode } from "@/types/list";
import { normalizeGenre } from "@shared/utils/genre";
import { usePageSearch } from "@/composables/usePageSearch";
defineOptions({ name: "LocalList" });

import { matchesSearch } from "@/utils/search/match";
import type { CoverItem } from "@/types/artist";
import type { PlaybackContext, Track } from "@shared/types/player";
import type { SSelectOption } from "@/components/ui/SSelect.vue";
import type { AlbumSummary, ArtistSummary, GenreSummary } from "@shared/types/library";
import { useLibraryStore } from "@/stores/library";
import CoverList from "@/components/list/CoverList.vue";
import { navigateToAlbum, navigateToArtist, navigateToGenre } from "@/utils/navigate";
import * as player from "@/core/player";
import IconLucideUsers from "~icons/lucide/users";
import IconLucideUserRound from "~icons/lucide/user-round";
import IconLucideMusic from "~icons/lucide/music";
import IconLucideDisc3 from "~icons/lucide/disc-3";
import IconLucideGuitar from "~icons/lucide/guitar";
import IconLucideArrowUpDown from "~icons/lucide/arrow-up-down";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const libraryStore = useLibraryStore();
const { artistAvatars } = storeToRefs(libraryStore);

const mode: BrowseSortKey =
  route.name === "album-list"
    ? "album"
    : ["genre-list", "unknown-genre"].includes(String(route.name))
      ? "genre"
      : "artist";

const searchQuery = usePageSearch();
const unknownGenrePage = computed(() => route.name === "unknown-genre");
const unknownGenreTracks = computed(() =>
  libraryStore.tracks.filter((track) => !track.genres?.some((genre) => genre.trim())),
);
const unknownGenreId = "missing:genre";

const browseSort = useBrowseSortStore();
const sortMode = computed<BrowseSortMode>({
  get: () => browseSort.collectionModes[mode],
  set: (value) => {
    browseSort.collectionModes[mode] = value;
  },
});

const sortOptions = computed<SSelectOption[]>(() => [
  { value: "default", label: t("songList.sort.default") },
  { value: "name", label: t("songList.sort.byName") },
  { value: "trackCount", label: t("songList.sort.byTrackCount") },
]);

const source = shallowRef<ArtistSummary[] | AlbumSummary[] | GenreSummary[]>([]);

/** Build the sorted cards matching this page's filter. */
const items = computed<CoverItem[]>(() => {
  const list: CoverItem[] =
    mode === "artist"
      ? (source.value as ArtistSummary[]).map((item) => ({
          id: encodeURIComponent(item.name),
          title: item.name,
          cover: artistAvatars.value[item.name.trim().toLowerCase()] ?? item.cover,
          subtitle: t("common.totalSongs", { count: item.trackCount }),
          trackCount: item.trackCount,
        }))
      : mode === "genre"
        ? (source.value as GenreSummary[]).map((item) => ({
            id: encodeURIComponent(item.name),
            title: item.name,
            cover: item.cover,
            subtitle: t("common.totalSongs", { count: item.trackCount }),
            trackCount: item.trackCount,
          }))
        : (source.value as AlbumSummary[]).map((item) => ({
            id: encodeURIComponent(item.name),
            title: item.name,
            cover: item.cover,
            subtitle: [item.artist || t("song.unknownArtist"), item.years?.join(" / ")]
              .filter(Boolean)
              .join(" · "),
            trackCount: item.trackCount,
          }));
  if (mode === "genre" && unknownGenreTracks.value.length) {
    list.push({
      id: unknownGenreId,
      title: t("genre.unknown"),
      cover: unknownGenreTracks.value.find((track) => track.cover)?.cover,
      subtitle: t("common.totalSongs", { count: unknownGenreTracks.value.length }),
      trackCount: unknownGenreTracks.value.length,
    });
  }
  if (sortMode.value === "name") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortMode.value === "trackCount") {
    list.sort((a, b) => b.trackCount - a.trackCount || a.title.localeCompare(b.title));
  }
  return list.filter((item) =>
    matchesSearch(
      mode === "genre" ? normalizeGenre(searchQuery.value) : searchQuery.value,
      item.title,
      mode === "album" ? item.subtitle : undefined,
    ),
  );
});

const config = computed(() => {
  if (mode === "artist") {
    return {
      title: t("artist.label"),
      countIcon: IconLucideUsers,
      countLabel: t("artist.totalArtists", { count: items.value.length }),
      emptyIcon: IconLucideUserRound,
      coverType: "artist" as const,
      minSize: 120,
      selectWidth: "w-32",
    };
  }
  if (mode === "genre") {
    return {
      title: t("genre.label"),
      countIcon: IconLucideGuitar,
      countLabel: t("genre.totalGenres", { count: items.value.length }),
      emptyIcon: IconLucideGuitar,
      coverType: "default" as const,
      minSize: 140,
      selectWidth: "w-40",
    };
  }
  return {
    title: t("album.label"),
    countIcon: IconLucideDisc3,
    countLabel: t("common.totalAlbums", { count: items.value.length }),
    emptyIcon: IconLucideDisc3,
    coverType: "default" as const,
    minSize: 140,
    selectWidth: "w-40",
  };
});

/** Navigate to a card's collection.
 * @param item - Card selected for navigation.
 */
const handleClick = (item: CoverItem): void => {
  if (mode === "genre" && item.id === unknownGenreId) void router.push({ name: "unknown-genre" });
  else if (mode === "artist") navigateToArtist(item.title);
  else if (mode === "genre") navigateToGenre(item.title);
  else navigateToAlbum(item.title);
};

/** Track the card being loaded to avoid duplicate playback requests. */
const playingItem = ref("");

/**
 * Load tracks for the card's collection type.
 * @param item - Artist, album, or genre card selected for playback.
 * @returns Tracks belonging to that card.
 */
const loadItemTracks = async (item: CoverItem): Promise<Track[]> => {
  if (mode === "genre" && item.id === unknownGenreId) return unknownGenreTracks.value;
  if (mode === "artist") {
    const profile = await libraryStore.getArtistProfile(item.title);
    return profile?.tracks ?? [];
  }
  const collection =
    mode === "genre"
      ? await libraryStore.getGenreCollection(item.title)
      : await libraryStore.getAlbumCollection(item.title);
  return collection?.tracks ?? [];
};

/**
 * Start the selected collection without navigating away from its card.
 * @param item - Card whose tracks should replace the queue.
 */
const handlePlay = async (item: CoverItem): Promise<void> => {
  if (playingItem.value === item.id) return;
  playingItem.value = item.id;
  try {
    const tracks = await loadItemTracks(item);
    if (tracks.length === 0) return;
    const context: PlaybackContext = {
      provider: "local",
      originId: mode === "genre" && item.id === unknownGenreId ? unknownGenreId : item.title,
      originType: mode,
      originName: item.title,
    };
    await player.playFrom(tracks, { startIndex: 0, context });
  } finally {
    playingItem.value = "";
  }
};

onMounted(async () => {
  if (mode === "genre" && !libraryStore.initialized) await libraryStore.load();
  source.value =
    mode === "artist"
      ? await libraryStore.getArtistList()
      : mode === "genre"
        ? await libraryStore.getGenreList()
        : await libraryStore.getAlbumList();
  // 拉取当前列表中尚未缓存的歌手头像
  if (mode === "artist") libraryStore.loadArtistAvatars();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <template v-if="unknownGenrePage">
      <h1 class="shrink-0 px-5 py-4 text-3xl font-bold">{{ t("genre.unknown") }}</h1>
      <div class="flex-1 min-h-0">
        <SongList
          :items="unknownGenreTracks"
          :search-query="searchQuery"
          enable-sort
          sort-key="collection.genre"
          :playback-context="{
            provider: 'local',
            originType: 'genre',
            originId: unknownGenreId,
            originName: t('genre.unknown'),
          }"
        />
      </div>
    </template>
    <template v-else>
      <div class="shrink-0 px-5 pb-2">
        <div class="flex items-center justify-between gap-4 mt-2 mb-4">
          <div class="flex items-baseline gap-4">
            <h1 class="text-3xl font-bold text-on-surface text-balance">{{ config.title }}</h1>
            <span
              v-if="items.length > 0"
              class="flex items-center gap-1 text-sm text-on-surface-variant/50"
            >
              <component :is="config.countIcon" class="size-3.5" />
              {{ config.countLabel }}
            </span>
          </div>
          <div
            v-if="source.length > 0"
            class="flex items-center gap-2 text-sm text-on-surface-variant/70"
          >
            <IconLucideArrowUpDown class="size-3.5 shrink-0" />
            <span class="shrink-0">{{ t("songList.sort.mode") }}</span>
            <div :class="[config.selectWidth, 'shrink-0']">
              <SSelect v-model="sortMode" :options="sortOptions" />
            </div>
          </div>
        </div>
      </div>
      <div class="flex-1 min-h-0">
        <CoverList
          v-if="items.length > 0"
          :items="items"
          :type="config.coverType"
          :min-size="config.minSize"
          :padding-x="20"
          :padding-bottom="24"
          playable
          @click="handleClick"
          @play="handlePlay"
        />
        <div v-else class="h-full flex items-center justify-center">
          <div class="text-center text-on-surface-variant/50">
            <component :is="config.emptyIcon" class="size-12 mx-auto mb-3 opacity-30" />
            <div class="text-sm mb-1">
              {{ t(searchQuery ? "search.noResults" : "library.noLocalData") }}
            </div>
            <div v-if="!searchQuery" class="text-xs mb-4 opacity-70">
              {{ t("library.noLocalDataHint") }}
            </div>
            <SButton
              v-if="!searchQuery"
              type="primary"
              variant="secondary"
              @click="router.push('/library')"
            >
              <template #icon><IconLucideMusic /></template>
              {{ t("library.goLibrary") }}
            </SButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
