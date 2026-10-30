<script setup lang="ts">
import type { Artist, PlaybackContext, Track, TrackSource } from "@shared/types/player";
import type { CollectionType } from "@/types/collection";
import type { SortField, SortOrder, SongListSortKey, SongListSortPreference } from "@/types/list";
import {
  SONG_LIST_COLUMNS,
  SONG_LIST_COLUMN_WIDTHS,
  type SongListColumn,
} from "@/utils/songListColumns";
import { useMediaStore } from "@/stores/media";
import { useStatusStore } from "@/stores/status";
import { useSettingsStore } from "@/stores/settings";
import { useTrackMenu } from "@/composables/useTrackMenu";
import { useMultiSelect } from "@/composables/useMultiSelect";
import { useFavorite } from "@/composables/useFavorite";
import { usePlaylistPicker } from "@/composables/usePlaylistPicker";
import { useFloatingPlayerBar } from "@/composables/useFloatingPlayerBar";
import { getVisibleGenres } from "@shared/utils/genre";
import { getTrackYear } from "@shared/utils/year";
import { matchesSearch } from "@/utils/search/match";
import { formatTime } from "@/utils/time";
import { formatFileSize } from "@/utils/format";
import { isLosslessQuality, getQualityLabel } from "@/utils/quality";
import { navigateToAlbum, navigateToArtist, navigateToGenre } from "@/utils/navigate";
import type { SVirtualListExposed } from "@/components/ui/SVirtualList.vue";
import * as player from "@/core/player";
import IconArrowUpDown from "~icons/lucide/arrow-up-down";
import IconArrowUpAz from "~icons/lucide/arrow-up-az";
import IconLucideListEnd from "~icons/lucide/list-end";
import IconLucideListPlus from "~icons/lucide/list-plus";
import IconLucideListMinus from "~icons/lucide/list-minus";
import IconLucideTrash2 from "~icons/lucide/trash-2";
import IconLucideArrowLeftRight from "~icons/lucide/arrow-left-right";
import IconLucideX from "~icons/lucide/x";
import IconLucideCloud from "~icons/lucide/cloud";
import IconLucideCloudOff from "~icons/lucide/cloud-off";
import IconFavorite from "~icons/material-symbols/favorite-rounded";
import IconFavoriteOutline from "~icons/material-symbols/favorite-outline-rounded";

const props = withDefaults(
  defineProps<{
    /** 歌曲列表数据 */
    items: Track[];
    /** 搜索关键词 */
    searchQuery?: string;
    /** 显示序号 */
    showIndex?: boolean;
    /** 显示专辑 */
    showAlbum?: boolean;
    /** 显示流派 */
    showGenre?: boolean;
    /** 显示时长 */
    showDuration?: boolean;
    /** 显示文件大小 */
    showSize?: boolean;
    /** 是否启用排序交互 */
    enableSort?: boolean;
    /** Persist sorting within this page category; omitted keys stay component-local. */
    sortKey?: SongListSortKey;
    /** 列表来源 */
    source?: TrackSource;
    /** 集合类型 */
    collectionType?: CollectionType;
    /** 集合 ID */
    collectionId?: string;
    /** 播放来源上下文 */
    playbackContext?: PlaybackContext;
    /** 是否有权从集合移除曲目 */
    canRemove?: boolean;
    /** 是否还能继续触底加载 */
    hasMore?: boolean;
    /** 触底加载中 */
    loadingMore?: boolean;
  }>(),
  {
    searchQuery: "",
    showIndex: true,
    showAlbum: true,
    showGenre: true,
    showDuration: true,
    showSize: true,
    enableSort: false,
    source: "local",
    collectionType: undefined,
    collectionId: undefined,
    playbackContext: undefined,
    canRemove: true,
    hasMore: false,
    loadingMore: false,
  },
);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const media = useMediaStore();
const status = useStatusStore();
const settings = useSettingsStore();
const fav = useFavorite();

const visibleColumns = computed(() => {
  const available: Record<SongListColumn, boolean> = {
    index: props.showIndex,
    title: true,
    album: props.showAlbum,
    genre: props.showGenre,
    year: true,
    actions: true,
    duration: props.showDuration,
    size: props.showSize,
  };
  const hidden = settings.appearance.songListHiddenColumns ?? [];
  return (settings.appearance.songListColumnOrder ?? SONG_LIST_COLUMNS).filter(
    (column) => available[column] && (column === "title" || !hidden.includes(column)),
  );
});

/** Check whether a column is enabled for this page and the saved layout.
 * @param column - Built-in column key.
 */
const isColumnVisible = (column: SongListColumn): boolean => visibleColumns.value.includes(column);

/** Position a cell on the same grid track as its header.
 * @param column - Built-in column key.
 */
const cellStyle = (column: SongListColumn) => ({
  gridColumn: visibleColumns.value.indexOf(column) + 1,
  gridRow: 1,
});

const columnStyle = computed(() => ({
  "--song-list-columns": visibleColumns.value
    .map((column) => SONG_LIST_COLUMN_WIDTHS[column])
    .join(" "),
}));
const minimumWidth = computed(() => {
  const widths: Record<SongListColumn, number> = {
    index: 32,
    title: 180,
    album: 140,
    genre: 100,
    year: 64,
    actions: 48,
    duration: 64,
    size: 72,
  };
  const hiddenWidth = SONG_LIST_COLUMNS.filter(
    (column) => !visibleColumns.value.includes(column),
  ).reduce((total, column) => total + widths[column] + 12, 0);
  return `${Math.max(240, 680 - hiddenWidth)}px`;
});

const { isFloatingBar: isFloatingPlayerBar, PLAYER_BAR_GAP } = useFloatingPlayerBar();

/** 排序器 默认使用 base 敏感度，忽略大小写 */
const textCollator = new Intl.Collator(undefined, {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
});

/** 当前播放歌曲 ID */
const playingId = computed(() => media.track?.id);

/** 专辑是否可跳转：本地不要求 id，其他源需要 album.id */
const isAlbumLinkable = (item: Track): boolean => {
  if (!item.album?.name) return false;
  return item.source === "local" || !!item.album.id;
};

/** 歌手是否可跳转：本地不要求 id，其他源需要 artist.id */
const isArtistLinkable = (item: Track, artist: Artist): boolean => {
  if (!artist.name) return false;
  return item.source === "local" || !!artist.id;
};

/**
 * 跳转到歌曲所属服务器的歌手页
 * @param item - 当前歌曲
 * @param artist - 歌手信息
 */
const goArtist = (item: Track, artist: Artist): void => {
  if (!isArtistLinkable(item, artist)) return;
  navigateToArtist(artist.name, {
    source: item.source,
    artistId: artist.id,
    serverId: item.serverId,
  });
};

/**
 * 跳转到歌曲所属服务器的专辑页
 * @param item - 当前歌曲
 */
const goAlbum = (item: Track): void => {
  if (!isAlbumLinkable(item)) return;
  navigateToAlbum(item.album?.name, {
    source: item.source,
    albumId: item.album?.id,
    serverId: item.serverId,
  });
};

/**
 * Resolve visible genre labels using the current display preference.
 * @param item - Track whose original metadata must remain unchanged.
 */
const trackGenres = (item: Track): string[] =>
  getVisibleGenres(item.genres, settings.preset.ignoreMusicGenre);

/** 流派是否可跳转：流派页仅聚合本地曲库 */
const isGenreLinkable = (item: Track): boolean => item.source === "local";

/** 跳转到流派页 */
const goGenre = (item: Track, genre: string): void => {
  if (!isGenreLinkable(item)) return;
  navigateToGenre(genre);
};

const localSortPreference = ref<SongListSortPreference>({ field: "none", order: "asc" });
const sortPreference = computed<SongListSortPreference>({
  get: () => (props.sortKey ? status.getSortPreference(props.sortKey) : localSortPreference.value),
  set: (preference) => {
    if (props.sortKey) status.setSortPreference(props.sortKey, preference);
    else localSortPreference.value = preference;
  },
});
const sortField = computed<SortField>({
  get: () => sortPreference.value.field,
  set: (field) => {
    sortPreference.value = { ...sortPreference.value, field };
  },
});
const sortOrder = computed<SortOrder>({
  get: () => sortPreference.value.order,
  set: (order) => {
    sortPreference.value = { ...sortPreference.value, order };
  },
});

/** 字段文案 key 映射 */
const sortFieldLabelKeyMap: Record<SortField, string> = {
  none: "songList.sort.default",
  title: "songList.sort.byTitle",
  artist: "songList.sort.byArtist",
  album: "songList.sort.byAlbum",
  year: "year.byYear",
  path: "songList.sort.byPath",
  duration: "songList.sort.byDuration",
  size: "songList.sort.bySize",
  mtime: "songList.sort.byMtime",
  ctime: "songList.sort.byCtime",
  track: "songList.sort.byTrack",
};

/** 表头显示的当前排序文案 */
const sortTitleText = computed(() => {
  if (!props.enableSort) return t("songList.title");
  if (sortField.value === "none") return t("songList.title");
  const arrow = sortOrder.value === "asc" ? "↑" : "↓";
  return `${t("songList.title")}（ ${t(sortFieldLabelKeyMap[sortField.value])} ${arrow} ）`;
});

/** Filter only the supplied collection using the shared metadata search rules. */
const filteredItems = computed(() => {
  if (!props.searchQuery.trim()) return props.items;
  return props.items.filter((track) =>
    matchesSearch(
      props.searchQuery,
      track.title,
      track.album?.name,
      ...track.artists.map((artist) => artist.name),
      ...trackGenres(track),
      getTrackYear(track)?.toString(),
    ),
  );
});

/** Preserve disc order and tagged track numbers across album searches. */
const albumDiscs = computed(() => {
  if (props.collectionType !== "album") return null;
  const groups = Map.groupBy(props.items, (track) => track.disc ?? 1);
  for (const tracks of groups.values()) {
    tracks.sort(
      (left, right) =>
        (left.track ?? Number.MAX_SAFE_INTEGER) - (right.track ?? Number.MAX_SAFE_INTEGER),
    );
  }
  if (groups.size < 2) return null;
  const trackNumbers = new Map<string, number>();
  for (const tracks of groups.values()) {
    tracks.forEach((track, position) => trackNumbers.set(track.id, track.track ?? position + 1));
  }
  return { groups, trackNumbers };
});

/** Attach disc headings to real tracks so playback and selection indexes stay aligned. */
const discLayout = computed(() => {
  const discs = albumDiscs.value;
  if (!discs || (props.enableSort && sortField.value !== "none")) return null;
  const items: Track[] = [];
  const headers = new Map<number, { disc: number; title?: string; count: number }>();
  const visibleIds = new Set(filteredItems.value.map((track) => track.id));
  for (const [disc, albumTracks] of [...discs.groups].sort(([left], [right]) => left - right)) {
    const tracks = albumTracks.filter((track) => visibleIds.has(track.id));
    if (!tracks.length) continue;
    const title = albumTracks.find((track) => track.discTitle)?.discTitle;
    headers.set(items.length, { disc, title, count: albumTracks.length });
    items.push(...tracks);
  }
  return { items, headers };
});

/** 排序后列表 */
const sortedItems = computed(() => {
  if (discLayout.value) return discLayout.value.items;
  if (!props.enableSort || sortField.value === "none") return filteredItems.value;
  const result = [...filteredItems.value];
  const field = sortField.value;
  const direction = sortOrder.value === "asc" ? 1 : -1;

  const toArtistText = (track: Track): string => track.artists.map((a) => a.name).join(" / ");
  const toAlbumText = (track: Track): string => track.album?.name ?? "";
  const toPathText = (track: Track): string => track.path ?? "";

  const compare = (a: Track, b: Track): number => {
    let value = 0;
    if (field === "title") value = textCollator.compare(a.title, b.title);
    else if (field === "artist") value = textCollator.compare(toArtistText(a), toArtistText(b));
    else if (field === "album") value = textCollator.compare(toAlbumText(a), toAlbumText(b));
    else if (field === "year") {
      const ay = getTrackYear(a);
      const by = getTrackYear(b);
      if (ay === undefined || by === undefined)
        return ay === by ? textCollator.compare(a.title, b.title) : ay === undefined ? 1 : -1;
      value = ay - by;
    } else if (field === "path") value = textCollator.compare(toPathText(a), toPathText(b));
    else if (field === "duration") value = a.duration - b.duration;
    else if (field === "size") value = (a.fileSize ?? 0) - (b.fileSize ?? 0);
    else if (field === "mtime") value = (a.mtime ?? 0) - (b.mtime ?? 0);
    else if (field === "ctime") value = (a.ctime ?? 0) - (b.ctime ?? 0);
    else /*(field === "track")*/ value = (a.track ?? 0) - (b.track ?? 0);
    if (value !== 0) return value * direction;
    const fallback = textCollator.compare(a.title, b.title);
    if (fallback !== 0) return fallback;
    return textCollator.compare(a.id, b.id);
  };

  result.sort(compare);
  return result;
});

/** 当前播放歌曲在过滤后列表中的索引 */
const playingIndex = computed(() => {
  if (!playingId.value) return -1;
  return sortedItems.value.findIndex((track) => track.id === playingId.value);
});

/** 虚拟列表引用 */
const virtualListRef = shallowRef<SVirtualListExposed | null>(null);

/** 定位到当前播放歌曲 */
const scrollToPlaying = (): void => {
  if (playingIndex.value >= 0) virtualListRef.value?.scrollToIndex(playingIndex.value);
};

/** 当前滚动位置 */
const scrollTop = ref(0);

/** 回顶按钮显示阈值 */
const canScrollTop = computed(() => scrollTop.value > 100);

const onScroll = (event: Event): void => {
  scrollTop.value = (event.target as HTMLElement).scrollTop;
  emit("scroll", event);
};

/** 批量操作 */
const batch = useMultiSelect(sortedItems, {
  source: computed(() => props.source),
  collectionType: computed(() => props.collectionType),
  collectionId: computed(() => props.collectionId),
  canRemove: computed(() => props.canRemove),
  playbackContext: computed(() => props.playbackContext),
  onChanged: (removedIds) => emit("change", removedIds),
});
const { deleteConfirmOpen, deleteDialogTitle, deleteDialogContent } = batch;

/** Whether compact song rows are enabled */
const isCompactList = computed(() => settings.appearance.songListStyle === "compact");

/** Base height shared by both row layouts. */
const rowHeight = computed(() => (isCompactList.value ? 56 : 88));

/** Disc headings have a fixed height independent of row density. */
const DISC_HEADER_HEIGHT = 40;

/** Supply stable exact heights without measuring album headings in the DOM. */
const discItemHeights = computed(() => {
  const layout = discLayout.value;
  if (!layout) return undefined;
  return layout.items.map(
    (_track, index) => rowHeight.value + (layout.headers.has(index) ? DISC_HEADER_HEIGHT : 0),
  );
});

/**
 * Build song-row classes
 * @param item - Track data
 * @returns Row container classes
 */
const trackRowClass = (item: Track): string[] => {
  const selected = batch.active.value && batch.selectedIds.value.has(item.id);
  const playing = playingId.value === item.id;

  if (isCompactList.value) {
    return [
      "group h-14 rounded-lg cursor-pointer transition-colors duration-150",
      batch.active.value
        ? selected
          ? "bg-primary/10"
          : "hover:bg-on-surface/5"
        : playing
          ? "bg-primary/14"
          : "hover:bg-on-surface/6 active:bg-on-surface/10",
    ];
  }

  return [
    "group h-19 rounded-xl cursor-pointer border-2 border-solid transition-[background-color,border-color] duration-200",
    batch.active.value
      ? selected
        ? "bg-primary/10 border-primary/30"
        : "bg-surface-panel border-primary/12 hover:border-primary/20 hover:bg-on-surface/5"
      : playing
        ? "bg-primary/16 border-primary/40"
        : "bg-surface-panel border-primary/12 hover:border-primary/30 hover:bg-on-surface/8 active:bg-on-surface/12",
  ];
};

/** 添加到歌单相关 */
const {
  open: pickerOpen,
  tracks: pickerTracks,
  mode: pickerMode,
  openPicker,
} = usePlaylistPicker();

/** 标签编辑弹窗 */
const tagEditorOpen = ref(false);
const tagEditorTrack = shallowRef<Track | null>(null);

/** 下载 */

/** 右键菜单 */
const contextTrack = shallowRef<Track | undefined>();
const { items: contextMenuItems, handleSelect: onContextMenu } = useTrackMenu(contextTrack, {
  collectionType: props.collectionType,
  canRemove: props.canRemove,
  playbackContext: computed(() => props.playbackContext),
  onAddToPlaylist: (track) => openPicker([track]),
  onRemove: (track) => batch.requestDelete([track], "remove"),
  onDeleteFile: (track) => batch.requestDelete([track], "file"),
  onRemoveFromCloud: (track) => batch.requestDelete([track], "cloud"),
  onEditTags: (track) => {
    tagEditorTrack.value = track;
    tagEditorOpen.value = true;
  },
});

/** 仅当右键命中歌曲行时放行上下文菜单 */
const onListContextMenu = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest("[data-song-item]")) {
    event.preventDefault();
    event.stopPropagation();
  }
};

/**
 * 双击歌曲项播放
 * @param item - Track data
 * @param index - 列表索引
 */
const onTrackDblClick = (item: Track, index: number): void => {
  if (batch.active.value) return;
  if (route.name === "search" && settings.player.searchPlayBehavior !== "all") {
    void player.playNow(item, props.playbackContext);
    return;
  }
  void player.playFrom(sortedItems.value, { startIndex: index, context: props.playbackContext });
};

const emit = defineEmits<{
  scroll: [event: Event];
  reachBottom: [];
  change: [removedIds: string[]];
}>();

onActivated(batch.exit);

defineExpose({
  /** 进入批量管理模式 */
  enterBatch: batch.enter,
});
</script>

<template>
  <div class="relative h-full" @contextmenu.capture="onListContextMenu">
    <div class="h-full overflow-x-auto overflow-y-hidden" data-song-scroll>
      <div class="h-full" :style="{ minWidth: minimumWidth }">
        <SContextMenu :items="contextMenuItems" @select="onContextMenu">
          <template #header>
            <div v-if="contextTrack">
              <div class="flex items-center gap-1.5 px-1 py-1">
                <SImg :src="contextTrack.cover" class="size-9 rounded-md shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium truncate">
                    {{ contextTrack.title }}
                  </div>
                  <div class="text-[11px] text-on-surface-variant/60 truncate">
                    {{ contextTrack.artists.map((a) => a.name).join(" / ") }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <SVirtualList
            ref="virtualListRef"
            :items="sortedItems"
            :item-height="rowHeight"
            :item-fixed="!discLayout"
            :exact-item-heights="discItemHeights"
            :padding-bottom="isFloatingPlayerBar ? PLAYER_BAR_GAP : 80"
            :get-item-key="(item: Track) => item.id"
            height="100%"
            @scroll="onScroll"
            @reach-bottom="emit('reachBottom')"
          >
            <!-- 搜索无结果 -->
            <template #empty>
              <div
                v-if="searchQuery"
                class="flex flex-col items-center gap-2 text-on-surface-variant/40"
              >
                <IconLucideSearchX class="size-8" />
                <span class="text-sm">{{ t("songList.noResults") }}</span>
              </div>
            </template>
            <!-- 固定表头 -->
            <template #header>
              <!-- 可选信息行 -->
              <slot name="topInfo" />
              <!-- 补偿滚动条占据的边缘 -->
              <div class="pr-1.5">
                <!-- 批量模式 -->
                <div
                  v-if="batch.active.value"
                  class="flex items-center gap-2 pl-3 pr-3 mx-3 h-10 text-sm"
                >
                  <div v-if="showIndex" class="w-8 shrink-0 flex items-center justify-center">
                    <SCheckbox
                      :checked="batch.isAllSelected.value"
                      :indeterminate="batch.isPartial.value"
                      size="small"
                      @update:checked="batch.toggleSelectAll"
                      @click.stop
                    />
                  </div>
                  <span class="text-on-surface-variant tabular-nums shrink-0">
                    {{ t("songList.batch.selected", { count: batch.selectedCount.value }) }}
                  </span>
                  <SDivider vertical />
                  <SButton
                    variant="ghost"
                    size="small"
                    :disabled="batch.selectedCount.value === 0"
                    @click="batch.invertSelection"
                  >
                    <template #icon><IconLucideArrowLeftRight class="size-3.5" /></template>
                    <span>{{ t("songList.batch.invert") }}</span>
                  </SButton>
                  <SButton
                    variant="ghost"
                    size="small"
                    :disabled="batch.selectedCount.value === 0"
                    @click="batch.addToQueue"
                  >
                    <template #icon><IconLucideListEnd class="size-3.5" /></template>
                    <span>{{ t("songList.batch.addToQueue") }}</span>
                  </SButton>
                  <SButton
                    v-if="source === 'local' || source === 'netease'"
                    variant="ghost"
                    size="small"
                    :disabled="batch.selectedCount.value === 0"
                    @click="openPicker(batch.selectedItems.value)"
                  >
                    <template #icon><IconLucideListPlus class="size-3.5" /></template>
                    <span>{{ t("collection.addTo", { type: t("collection.playlist") }) }}</span>
                  </SButton>
                  <SButton
                    v-if="batch.canRemove.value"
                    variant="ghost"
                    size="small"
                    :disabled="batch.selectedCount.value === 0"
                    @click="batch.batchRemove"
                  >
                    <template #icon><IconLucideListMinus class="size-3.5" /></template>
                    <span>
                      {{ t("collection.removeFrom", { type: batch.collectionTypeLabel.value }) }}
                    </span>
                  </SButton>
                  <SButton
                    v-if="batch.canRemoveFromCloud.value"
                    type="error"
                    variant="ghost"
                    size="small"
                    :disabled="batch.selectedCount.value === 0"
                    @click="batch.batchRemoveFromCloud"
                  >
                    <template #icon><IconLucideCloudOff class="size-3.5" /></template>
                    <span>{{ t("cloud.removeAction") }}</span>
                  </SButton>
                  <SButton
                    v-if="source === 'local'"
                    type="error"
                    variant="ghost"
                    size="small"
                    :disabled="batch.selectedCount.value === 0"
                    @click="batch.batchDelete"
                  >
                    <template #icon><IconLucideTrash2 class="size-3.5" /></template>
                    <span>{{ t("songList.context.deleteFile") }}</span>
                  </SButton>
                  <SDivider vertical />
                  <SButton variant="ghost" size="small" @click="batch.exit">
                    <template #icon><IconLucideX class="size-3.5" /></template>
                    <span>{{ t("songList.batch.exit") }}</span>
                  </SButton>
                </div>
                <!-- 普通模式 -->
                <div
                  v-else
                  data-song-header
                  :style="columnStyle"
                  class="song-list-columns mx-3 h-10 border-2 border-solid border-transparent text-sm text-on-surface-variant/60"
                >
                  <div
                    v-if="isColumnVisible('index')"
                    class="w-8 shrink-0 flex items-center justify-center"
                    data-song-column="index"
                    :style="cellStyle('index')"
                  >
                    <span>#</span>
                  </div>
                  <div
                    v-if="isColumnVisible('title')"
                    class="flex-1 min-w-0"
                    data-song-column="title"
                    :style="cellStyle('title')"
                  >
                    <SPopover
                      v-if="enableSort"
                      :side-offset="6"
                      trigger="click"
                      side="bottom"
                      align="start"
                      block
                    >
                      <template #trigger>
                        <div
                          class="w-full h-full truncate px-1.5 py-1 rounded-md cursor-pointer transition-colors hover:bg-on-surface/8"
                        >
                          {{ sortTitleText }}
                        </div>
                      </template>
                      <div class="w-60 flex flex-col gap-3 text-sm">
                        <div class="flex items-center gap-2 text-xs">
                          <IconArrowUpDown class="size-3.5" />
                          <span>{{ t("songList.sort.mode") }}</span>
                        </div>
                        <SRadioGroup v-model:value="sortField" size="small">
                          <SRadio value="none" :label="t('songList.sort.default')" />
                          <SRadio value="title" :label="t('songList.sort.byTitle')" />
                          <SRadio value="artist" :label="t('songList.sort.byArtist')" />
                          <SRadio value="album" :label="t('songList.sort.byAlbum')" />
                          <SRadio value="year" :label="t('year.byYear')" />
                          <SRadio value="path" :label="t('songList.sort.byPath')" />
                          <SRadio value="duration" :label="t('songList.sort.byDuration')" />
                          <SRadio value="size" :label="t('songList.sort.bySize')" />
                          <SRadio value="mtime" :label="t('songList.sort.byMtime')" />
                          <SRadio value="ctime" :label="t('songList.sort.byCtime')" />
                          <SRadio value="track" :label="t('songList.sort.byTrack')" />
                        </SRadioGroup>

                        <div class="h-px bg-outline-variant/25" />

                        <div class="flex items-center gap-2 text-xs">
                          <IconArrowUpAz class="size-3.5" />
                          <span>{{ t("songList.sort.order") }}</span>
                        </div>
                        <SRadioGroup
                          v-model:value="sortOrder"
                          size="small"
                          :disabled="sortField === 'none'"
                        >
                          <SRadio value="asc" :label="t('songList.sort.asc')" />
                          <SRadio value="desc" :label="t('songList.sort.desc')" />
                        </SRadioGroup>
                      </div>
                    </SPopover>
                    <div v-else class="w-full h-full px-1.5 py-1">
                      {{ t("songList.title") }}
                    </div>
                  </div>
                  <div
                    v-if="isColumnVisible('album')"
                    class="flex-1 min-w-0"
                    data-song-column="album"
                    :style="cellStyle('album')"
                  >
                    {{ t("songList.album") }}
                  </div>
                  <div
                    v-if="isColumnVisible('genre')"
                    class="min-w-0 truncate"
                    data-song-column="genre"
                    :style="cellStyle('genre')"
                  >
                    {{ t("songList.genre") }}
                  </div>
                  <div
                    v-if="isColumnVisible('year')"
                    class="min-w-0 truncate"
                    data-song-column="year"
                    :style="cellStyle('year')"
                  >
                    {{ t("year.singular") }}
                  </div>
                  <div
                    v-if="isColumnVisible('actions')"
                    class="min-w-0 truncate text-center text-xs leading-6"
                    data-song-column="actions"
                    :style="cellStyle('actions')"
                  >
                    {{ t("songList.actions") }}
                  </div>
                  <div
                    v-if="isColumnVisible('duration')"
                    class="min-w-0 truncate text-center"
                    data-song-column="duration"
                    :style="cellStyle('duration')"
                  >
                    {{ t("songList.duration") }}
                  </div>
                  <div
                    v-if="isColumnVisible('size')"
                    class="min-w-0 truncate text-center"
                    data-song-column="size"
                    :style="cellStyle('size')"
                  >
                    {{ t("songList.size") }}
                  </div>
                </div>
              </div>
            </template>
            <!-- 列表项 -->
            <template #default="{ item, index }: { item: Track; index: number }">
              <div
                v-if="discLayout?.headers.has(index)"
                class="mx-6 h-10 flex items-center gap-3 text-on-surface-variant"
                :class="!isCompactList && index > 0 ? 'pb-3' : ''"
              >
                <IconLucideDisc3
                  class="size-4 translate-y-px shrink-0 text-primary/70"
                  aria-hidden="true"
                />
                <h2
                  class="min-w-0 flex-1 truncate text-sm font-semibold"
                  :title="discLayout.headers.get(index)!.title"
                >
                  {{ t("collection.disc", { disc: discLayout.headers.get(index)!.disc }) }}
                  <span
                    v-if="discLayout.headers.get(index)!.title"
                    class="font-normal text-on-surface-variant/70"
                  >
                    · {{ discLayout.headers.get(index)!.title }}
                  </span>
                </h2>
                <span class="shrink-0 text-xs tabular-nums text-on-surface-variant/50">
                  {{ t("common.totalSongs", { count: discLayout.headers.get(index)!.count }) }}
                </span>
              </div>

              <div :class="isCompactList ? 'px-3' : 'px-3 pb-3'">
                <div
                  data-song-item
                  :style="columnStyle"
                  class="song-list-columns"
                  :class="trackRowClass(item)"
                  @click="batch.active.value ? batch.toggle(item.id) : undefined"
                  @dblclick="onTrackDblClick(item, index)"
                  @contextmenu="contextTrack = item"
                >
                  <!-- 序号 / 多选 -->
                  <div
                    v-if="isColumnVisible('index')"
                    class="w-8 shrink-0 flex items-center justify-center relative"
                    :class="
                      batch.active.value
                        ? ''
                        : playingId === item.id
                          ? 'text-primary'
                          : 'text-on-surface-variant'
                    "
                    data-song-column="index"
                    :style="cellStyle('index')"
                    @click.stop="
                      batch.active.value
                        ? batch.toggle(item.id)
                        : playingId === item.id
                          ? player.togglePlay()
                          : player.playNow(item, props.playbackContext)
                    "
                  >
                    <!-- 多选模式 -->
                    <SCheckbox
                      v-if="batch.active.value"
                      :checked="batch.selectedIds.value.has(item.id)"
                      size="small"
                      @update:checked="batch.toggle(item.id)"
                      @click.stop
                    />
                    <!-- 普通模式 -->
                    <template v-else>
                      <span
                        v-if="playingId !== item.id"
                        class="text-sm font-bold tabular-nums group-hover:opacity-0 transition-opacity duration-300"
                      >
                        {{ discLayout ? albumDiscs?.trackNumbers.get(item.id) : index + 1 }}
                      </span>
                      <IconLucideMusic
                        v-else
                        class="size-5 group-hover:opacity-0 transition-opacity duration-300"
                      />
                      <div
                        class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-300 group-hover:scale-100 scale-80 cursor-pointer"
                      >
                        <IconLucidePause
                          v-if="playingId === item.id && status.isPlaying"
                          class="size-5"
                        />
                        <IconLucidePlay v-else class="size-5" />
                      </div>
                    </template>
                  </div>
                  <!-- 信息 -->
                  <div
                    v-if="isColumnVisible('title')"
                    class="flex-1 min-w-0 flex items-center gap-3"
                    data-song-column="title"
                    :style="cellStyle('title')"
                  >
                    <SImg
                      :src="item.cover"
                      :class="[
                        'shrink-0',
                        isCompactList ? 'size-9 rounded-md' : 'size-12 rounded-lg',
                      ]"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-baseline gap-1.5 min-w-0">
                        <span
                          class="font-medium truncate"
                          :class="[
                            isCompactList ? 'text-sm' : 'text-base',
                            playingId === item.id ? 'text-primary' : '',
                          ]"
                          :title="item.title"
                        >
                          {{ item.title }}
                        </span>
                        <IconLucideCloud
                          v-if="item.cloud"
                          class="size-3.5 shrink-0 self-center"
                          :class="
                            playingId === item.id ? 'text-primary/60' : 'text-on-surface-variant/60'
                          "
                        />
                        <span
                          v-if="item.comment && settings.preset.showSubtitle"
                          class="flex-1 min-w-0 text-base truncate"
                          :class="
                            playingId === item.id ? 'text-primary/60' : 'text-on-surface-variant/60'
                          "
                        >
                          ({{ item.comment }})
                        </span>
                      </div>
                      <div
                        class="truncate flex items-center gap-1"
                        :style="{
                          fontSize: isCompactList ? '12px' : '14px',
                          marginTop: isCompactList ? '2px' : '4px',
                        }"
                        :class="
                          playingId === item.id ? 'text-primary/70' : 'text-on-surface-variant'
                        "
                      >
                        <STag
                          v-if="item.quality && !settings.preset.hideQualityTag"
                          :type="isLosslessQuality(item.quality) ? 'warning' : 'default'"
                          variant="outline"
                          size="tiny"
                          class="shrink-0"
                        >
                          {{ getQualityLabel(item.quality) }}
                        </STag>
                        <span class="truncate">
                          <template v-for="(artist, i) in item.artists" :key="artist.id ?? i">
                            <span
                              class="transition-opacity"
                              :class="
                                isArtistLinkable(item, artist)
                                  ? 'cursor-pointer hover:opacity-70'
                                  : 'opacity-50'
                              "
                              @click.stop="goArtist(item, artist)"
                            >
                              {{ artist.name }}
                            </span>
                            <span v-if="i < item.artists.length - 1" class="mx-0.5 opacity-50">
                              /
                            </span>
                          </template>
                          <span v-if="!item.artists?.length" class="opacity-50">
                            {{ t("playlist.unknownArtist") }}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <!-- 专辑 -->
                  <div
                    v-if="isColumnVisible('album')"
                    :title="item.album?.name"
                    class="flex-1 min-w-0 truncate text-sm"
                    :class="playingId === item.id ? 'text-primary/70' : 'text-on-surface'"
                    data-song-column="album"
                    :style="cellStyle('album')"
                  >
                    <span
                      class="transition-opacity"
                      :class="
                        isAlbumLinkable(item) ? 'cursor-pointer hover:opacity-70' : 'opacity-50'
                      "
                      @click.stop="goAlbum(item)"
                    >
                      {{ item.album?.name || t("collection.unknownAlbum") }}
                    </span>
                  </div>
                  <!-- 流派 -->
                  <div
                    v-if="isColumnVisible('genre')"
                    :title="trackGenres(item).join(' / ')"
                    class="min-w-0 truncate text-sm"
                    :class="playingId === item.id ? 'text-primary/70' : 'text-on-surface'"
                    data-song-column="genre"
                    :style="cellStyle('genre')"
                  >
                    <template v-if="trackGenres(item).length">
                      <template v-for="(genre, gi) in trackGenres(item)" :key="genre">
                        <span
                          class="transition-opacity"
                          :class="isGenreLinkable(item) ? 'cursor-pointer hover:opacity-70' : ''"
                          @click.stop="goGenre(item, genre)"
                        >
                          {{ genre }}
                        </span>
                        <span v-if="gi < trackGenres(item).length - 1" class="mx-0.5 opacity-50">
                          /
                        </span>
                      </template>
                    </template>
                    <button
                      v-else
                      type="button"
                      data-unknown-genre-link
                      :disabled="!isGenreLinkable(item)"
                      class="appearance-none border-none bg-transparent p-0 text-left text-inherit"
                      :class="
                        isGenreLinkable(item)
                          ? 'cursor-pointer hover:underline focus-visible:underline'
                          : 'opacity-50'
                      "
                      @click.stop="router.push({ name: 'unknown-genre' })"
                      @dblclick.stop
                    >
                      {{ t("genre.unknown") }}
                    </button>
                  </div>
                  <div
                    v-if="isColumnVisible('year')"
                    class="min-w-0 truncate text-sm tabular-nums text-on-surface-variant"
                    data-song-column="year"
                    :style="cellStyle('year')"
                  >
                    <button
                      type="button"
                      data-year-link
                      class="appearance-none border-none bg-transparent p-0 text-left text-inherit cursor-pointer hover:underline focus-visible:underline"
                      :aria-label="getTrackYear(item)?.toString() ?? t('year.unknown')"
                      :title="getTrackYear(item)?.toString() ?? t('year.unknown')"
                      @click.stop="
                        router.push({
                          name: 'year',
                          params: { year: getTrackYear(item) ?? 'unknown' },
                        })
                      "
                      @dblclick.stop
                    >
                      {{ getTrackYear(item) ?? "—" }}
                    </button>
                  </div>
                  <!-- 红心：批量模式下隐藏，其余始终显示 -->
                  <div
                    v-if="isColumnVisible('actions') && !batch.active.value"
                    class="justify-self-center flex items-center justify-center"
                    data-song-column="actions"
                    :style="cellStyle('actions')"
                    @click.stop
                  >
                    <SButton
                      type="primary"
                      variant="text"
                      circle
                      :size="28"
                      :icon-size="20"
                      :disabled="!fav.isSupported(item)"
                      @click="fav.toggle(item)"
                    >
                      <template #icon>
                        <SIconSwap :active="fav.isLiked(item)">
                          <template #on><IconFavorite /></template>
                          <template #off><IconFavoriteOutline /></template>
                        </SIconSwap>
                      </template>
                    </SButton>
                  </div>
                  <div
                    v-else-if="isColumnVisible('actions')"
                    class="justify-self-center"
                    data-song-column="actions"
                    :style="cellStyle('actions')"
                  />
                  <!-- 时长 -->
                  <div
                    v-if="isColumnVisible('duration')"
                    class="min-w-0 truncate text-center text-sm tabular-nums"
                    :class="playingId === item.id ? 'text-primary/60' : 'text-on-surface-variant'"
                    data-song-column="duration"
                    :style="cellStyle('duration')"
                  >
                    {{ formatTime(item.duration) }}
                  </div>
                  <!-- 文件大小 -->
                  <div
                    v-if="isColumnVisible('size')"
                    class="min-w-0 truncate text-center text-sm tabular-nums"
                    :class="playingId === item.id ? 'text-primary/60' : 'text-on-surface-variant'"
                    data-song-column="size"
                    :style="cellStyle('size')"
                  >
                    {{ item.fileSize ? formatFileSize(item.fileSize) : "—" }}
                  </div>
                </div>
              </div>
            </template>
            <template #footer>
              <slot name="footer">
                <div
                  v-if="sortedItems.length > 0 && loadingMore"
                  class="py-3 flex items-center justify-center gap-2 text-sm text-on-surface-variant/50"
                >
                  <SLoading class="size-3.5 text-primary/70 shrink-0" />
                  <span>{{ t("common.loading") }}</span>
                </div>
                <div
                  v-else-if="sortedItems.length > 0 && !hasMore"
                  class="py-3 text-center text-sm text-on-surface-variant/40"
                >
                  {{ t("common.noMore") }}
                </div>
              </slot>
            </template>
          </SVirtualList>
        </SContextMenu>
      </div>
    </div>
    <!-- 浮动按钮 -->
    <div
      class="absolute right-6 z-20 flex flex-col gap-3 transition-[bottom] duration-300"
      :class="isFloatingPlayerBar ? 'bottom-26' : 'bottom-5'"
    >
      <!-- 回到顶部 -->
      <Transition name="fade">
        <div
          v-if="canScrollTop && !batch.active.value"
          class="rounded-full bg-surface-panel backdrop-blur-2xl backdrop-saturate-150 shadow-lg border border-solid border-primary/10"
        >
          <SButton
            type="primary"
            variant="bordered"
            circle
            :size="40"
            @click="virtualListRef?.scrollTo(0)"
          >
            <template #icon>
              <IconLucideArrowUp class="size-4.5" />
            </template>
          </SButton>
        </div>
      </Transition>
      <!-- 定位歌曲 -->
      <Transition name="fade">
        <div
          v-if="playingIndex >= 0 && !batch.active.value"
          class="rounded-full bg-surface-panel backdrop-blur-2xl backdrop-saturate-150 shadow-lg border border-solid border-primary/10"
        >
          <SButton type="primary" variant="bordered" circle :size="40" @click="scrollToPlaying">
            <template #icon>
              <IconLucideLocate class="size-4.5" />
            </template>
          </SButton>
        </div>
      </Transition>
    </div>
    <!-- 删除确认弹窗 -->
    <SDialog v-model:open="deleteConfirmOpen" :title="deleteDialogTitle">
      <p class="text-sm text-on-surface-variant">{{ deleteDialogContent }}</p>
      <template #footer>
        <SButton variant="secondary" @click="batch.cancelDelete">{{ t("common.cancel") }}</SButton>
        <SButton type="error" @click="batch.confirmDelete">{{ t("common.confirm") }}</SButton>
      </template>
    </SDialog>
    <!-- 添加到歌单 -->
    <PlaylistPickerDialog v-model:open="pickerOpen" :mode="pickerMode" :tracks="pickerTracks" />
    <!-- 编辑元数据 -->
    <TagEditorDialog v-model:open="tagEditorOpen" :track="tagEditorTrack" />
  </div>
</template>

<style scoped>
.song-list-columns {
  display: grid;
  grid-template-columns: var(--song-list-columns);
  align-items: center;
  column-gap: 0.75rem;
  padding-inline: 0.75rem;
}
</style>
