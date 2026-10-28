<script setup lang="ts">
import type { Component } from "vue";
import { createSettingsDragSort } from "@/composables/useSettingsDragSort";
import type { SidebarPlaylistOrder } from "@/types/settings";
import type { ContentScope } from "@/types/collection";
import type { SSelectOption } from "@/components/ui/SSelect.vue";
import { DEFAULT_SIDEBAR_NAV_GROUPS, SIDEBAR_GROUP_MY_PLAYLISTS } from "@/types/settings";
import { SIDEBAR_NAV_META, applySavedOrder } from "@/components/layout/sidebarNav";
import { useSettingsStore } from "@/stores/settings";
import { usePlaylistStore } from "@/stores/playlist";
import { dialog } from "@/composables/useDialog";

defineOptions({ inheritAttrs: false });

const { t } = useI18n();
const settings = useSettingsStore();
const playlistStore = usePlaylistStore();
const open = ref(false);

interface EditorGroup {
  /** 本地稳定 id，仅用于渲染 key */
  id: number;
  name: string;
  showName: boolean;
  keys: string[];
}

let nextGroupId = 1;
const groups = ref<EditorGroup[]>([]);
const hidden = ref<string[]>([]);
const keepEmptyDivider = ref(false);
const nameWithDivider = ref(false);
const playlistOrder = ref<SidebarPlaylistOrder>({ myLocal: [], myOnline: [], subscribed: [] });
/** 歌单分组卡片展开状态（默认收起） */
const expandedMy = ref(false);
/** 「我的歌单」卡片内的来源切换 */
const mySource = ref<ContentScope>("local");

const groupsEl = ref<HTMLElement | null>(null);
const navListEls = ref<HTMLElement[]>([]);
const myListEl = ref<HTMLElement | null>(null);

watch(open, (val) => {
  if (!val) return;
  groups.value = settings.appearance.sidebarNavGroups.map((group) => ({
    id: nextGroupId++,
    name: group.name,
    showName: group.showName,
    keys: [...group.keys],
  }));
  hidden.value = [...settings.appearance.sidebarHiddenKeys];
  keepEmptyDivider.value = settings.appearance.sidebarKeepEmptyDivider;
  nameWithDivider.value = settings.appearance.sidebarNameWithDivider;
  playlistOrder.value = {
    myLocal: [...settings.appearance.sidebarPlaylistOrder.myLocal],
    myOnline: [...settings.appearance.sidebarPlaylistOrder.myOnline],
    subscribed: [...settings.appearance.sidebarPlaylistOrder.subscribed],
  };
  expandedMy.value = false;
  mySource.value = "local";
  if (!playlistStore.initialized) playlistStore.load();
});

let sortables: ReturnType<typeof createSettingsDragSort>[] = [];

/** Release drag listeners and previews when the editor closes or changes its lists. */
const destroySortables = (): void => {
  for (const instance of sortables) instance.destroy();
  sortables = [];
};

/** Attach playlist ordering to the dialog draft.
 * @param el - Playlist list element.
 * @param rowsOf - Rows in their current displayed order.
 * @param targetOf - Playlist order field to update.
 */
const attachPlaylistSortable = (
  el: HTMLElement,
  rowsOf: () => { key: string }[],
  targetOf: () => keyof SidebarPlaylistOrder,
): void => {
  sortables.push(
    createSettingsDragSort(el, {
      handle: ".item-handle",
      draggable: "[data-playlist-key]",
      onEnd: (evt) => {
        const { oldDraggableIndex: oldIndex, newDraggableIndex: newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        const keys = rowsOf().map((row) => row.key);
        const [moved] = keys.splice(oldIndex, 1);
        keys.splice(newIndex, 0, moved);
        playlistOrder.value[targetOf()] = keys;
      },
    }),
  );
};

/** Attach queue-style dragging to groups, navigation rows and expanded playlists. */
const initSortables = (): void => {
  destroySortables();
  if (groupsEl.value) {
    sortables.push(
      createSettingsDragSort(groupsEl.value, {
        handle: ".group-handle",
        draggable: "[data-editor-group]",
        onEnd: (evt) => {
          const { oldDraggableIndex: oldIndex, newDraggableIndex: newIndex } = evt;
          if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
          const [moved] = groups.value.splice(oldIndex, 1);
          groups.value.splice(newIndex, 0, moved);
        },
      }),
    );
  }
  for (const el of navListEls.value) {
    sortables.push(
      createSettingsDragSort(el, {
        group: "sidebar-nav-items",
        handle: ".item-handle",
        draggable: "[data-nav-key]",
        onEnd: (evt) => {
          const from = Number((evt.from as HTMLElement).dataset.groupList);
          const to = Number((evt.to as HTMLElement).dataset.groupList);
          const { oldDraggableIndex: oldIndex, newDraggableIndex: newIndex } = evt;
          if (oldIndex == null || newIndex == null) return;
          if (from === to && oldIndex === newIndex) return;
          const [moved] = groups.value[from].keys.splice(oldIndex, 1);
          groups.value[to].keys.splice(newIndex, 0, moved);
        },
      }),
    );
  }
  if (myListEl.value) {
    attachPlaylistSortable(
      myListEl.value,
      () => myRows.value,
      () => myOrderKey.value,
    );
  }
};

watch(
  [
    groupsEl,
    myListEl,
    open,
    () =>
      groups.value
        .map((group) => group.id)
        .sort()
        .join(","),
  ],
  () => {
    destroySortables();
    if (open.value && groupsEl.value) {
      void nextTick(() => {
        if (open.value) initSortables();
      });
    }
  },
);

onBeforeUnmount(destroySortables);

/** Move a sidebar group, navigation entry or playlist with the handle's arrow keys.
 * @param event - Keyboard input from the focused drag handle.
 * @param values - Draft ordering to update.
 * @param index - Current item position.
 */
const moveByKeyboard = async <T,>(
  event: KeyboardEvent,
  values: T[],
  index: number,
): Promise<void> => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  event.stopPropagation();
  const target = index + (event.key === "ArrowUp" ? -1 : 1);
  if (target < 0 || target >= values.length) return;
  const handle = event.currentTarget as HTMLElement;
  const [moved] = values.splice(index, 1);
  values.splice(target, 0, moved);
  await nextTick();
  handle.focus();
};

/** Reorder the displayed playlists using the same keyboard controls as navigation.
 * @param event - Keyboard input from a playlist drag handle.
 * @param key - Stable playlist key.
 */
const movePlaylistByKeyboard = (event: KeyboardEvent, key: string): void => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const keys = myRows.value.map((row) => row.key);
  playlistOrder.value[myOrderKey.value] = keys;
  void moveByKeyboard(event, playlistOrder.value[myOrderKey.value], keys.indexOf(key));
};

interface EditorRow {
  key: string;
  label: string;
  icon?: Component;
  hideable: boolean;
  featureOff: boolean;
}

const editorGroups = computed(() =>
  groups.value.map((group) => ({
    id: group.id,
    name: group.name,
    showName: group.showName,
    rows: group.keys
      .filter((key) => SIDEBAR_NAV_META[key])
      .map((key): EditorRow => {
        const entry = SIDEBAR_NAV_META[key];
        return {
          key,
          label: entry ? t(entry.labelKey) : key,
          icon: entry?.icon,
          hideable: entry?.hideable ?? true,
          featureOff:
            (key === "/download" && !settings.system.download.enabled) ||
            (key === "/streaming" && !settings.system.streaming.enabled),
        };
      }),
  })),
);

const sourceOptions = computed<SSelectOption[]>(() => [
  { value: "local", label: t("collection.localPlaylist") },
]);

const onMySourceChange = (value: unknown): void => {
  mySource.value = value as ContentScope;
};

const myOrderKey = computed<"myLocal" | "myOnline">(() =>
  mySource.value === "local" ? "myLocal" : "myOnline",
);

/** 「我的歌单」当前来源的歌单行（应用工作副本顺序） */
const myRows = computed(() => {
  const rows = playlistStore.playlists.map((pl) => ({
    key: `/collection/local/playlist/${pl.id}`,
    title: pl.title,
  }));
  return applySavedOrder(rows, playlistOrder.value[myOrderKey.value]);
});

const isHidden = (key: string): boolean => hidden.value.includes(key);

const toggleHidden = (key: string): void => {
  if (isHidden(key)) hidden.value = hidden.value.filter((item) => item !== key);
  else hidden.value = [...hidden.value, key];
};

const setGroupName = (index: number, name: string): void => {
  groups.value[index].name = name;
};

const toggleShowName = (index: number): void => {
  groups.value[index].showName = !groups.value[index].showName;
};

/** Add an empty draft group without rebuilding existing rows. */
const addGroup = (): void => {
  groups.value.push({ id: nextGroupId++, name: "", showName: false, keys: [] });
};

/** Remove a group while retaining its entries in the adjacent group.
 * @param index - Group being removed.
 */
const removeGroup = (index: number): void => {
  if (groups.value.length <= 1) return;
  const removed = groups.value[index];
  if (index > 0) groups.value[index - 1].keys.push(...removed.keys);
  else groups.value[1].keys.unshift(...removed.keys);
  groups.value.splice(index, 1);
};

const handleConfirm = (): void => {
  settings.appearance.sidebarNavGroups = groups.value.map((group) => ({
    name: group.name.trim(),
    showName: group.showName,
    keys: [...group.keys],
  }));
  settings.appearance.sidebarHiddenKeys = hidden.value.filter((key) => key !== "/");
  settings.appearance.sidebarKeepEmptyDivider = keepEmptyDivider.value;
  settings.appearance.sidebarNameWithDivider = nameWithDivider.value;
  settings.appearance.sidebarPlaylistOrder = {
    myLocal: [...playlistOrder.value.myLocal],
    myOnline: [...playlistOrder.value.myOnline],
    subscribed: [...playlistOrder.value.subscribed],
  };
  open.value = false;
};

/** Restore the default sidebar draft after confirmation. */
const handleReset = async (): Promise<void> => {
  const ok = await dialog.confirm({
    title: t("settings.sidebarCustomize.confirmResetTitle"),
    description: t("settings.sidebarCustomize.confirmResetDesc"),
    type: "warning",
    confirmText: t("common.reset"),
  });
  if (!ok) return;
  groups.value = DEFAULT_SIDEBAR_NAV_GROUPS.map((group) => ({
    id: nextGroupId++,
    name: group.name,
    showName: group.showName,
    keys: [...group.keys],
  }));
  hidden.value = [];
  keepEmptyDivider.value = false;
  nameWithDivider.value = false;
  playlistOrder.value = { myLocal: [], myOnline: [], subscribed: [] };
};
</script>

<template>
  <SButton type="primary" variant="secondary" size="small" @click="open = true">
    {{ t("common.configure") }}
  </SButton>
  <SDialog
    v-model:open="open"
    :title="t('settings.sidebarCustomize.label')"
    :description="t('settings.sidebarCustomize.hint')"
    width="min(460px, calc(100vw - 32px))"
  >
    <div class="flex flex-col gap-2.5">
      <span class="text-xs text-on-surface-variant/60">
        {{ t("settings.sidebarCustomize.nav") }}
      </span>
      <div ref="groupsEl" class="flex flex-col gap-2.5">
        <SCard
          v-for="(group, gi) in editorGroups"
          :key="group.id"
          data-editor-group
          :data-config-drag-id="`group-${group.id}`"
          flush
          class="flex flex-col gap-1.5 p-2"
        >
          <div class="flex items-center gap-2 px-1 min-h-6.5">
            <button
              type="button"
              class="group-handle flex size-7 items-center justify-center shrink-0 rounded bg-transparent border-none text-on-surface-variant/60 cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline-primary"
              :aria-label="t('settings.sidebarCustomize.group', { n: gi + 1 })"
              @keydown="moveByKeyboard($event, groups, gi)"
            >
              <IconLucideGripVertical class="size-4" />
            </button>
            <SInput
              :model-value="group.name"
              size="small"
              class="flex-1 min-w-0"
              :placeholder="t('settings.sidebarCustomize.group', { n: gi + 1 })"
              @update:model-value="setGroupName(gi, $event)"
            />
            <SButton
              :type="group.showName ? 'primary' : 'default'"
              variant="tertiary"
              :size="26"
              :icon-size="14"
              round
              :title="t('settings.sidebarCustomize.showName')"
              @click="toggleShowName(gi)"
            >
              <template #icon>
                <SIconSwap :active="group.showName">
                  <template #on><IconLucideType /></template>
                  <template #off><IconSpTypeOff /></template>
                </SIconSwap>
              </template>
            </SButton>
            <SButton
              v-if="editorGroups.length > 1"
              variant="tertiary"
              :size="26"
              :icon-size="14"
              round
              @click="removeGroup(gi)"
            >
              <template #icon><IconLucideTrash2 /></template>
            </SButton>
          </div>
          <div ref="navListEls" class="flex flex-col gap-1.5 min-h-9" :data-group-list="gi">
            <div
              v-for="row in group.rows"
              :key="row.key"
              :data-nav-key="row.key"
              :data-config-drag-id="row.key"
              class="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-on-surface/4"
            >
              <button
                type="button"
                class="item-handle flex size-7 items-center justify-center shrink-0 rounded bg-transparent border-none text-on-surface-variant/60 cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline-primary"
                :aria-label="row.label"
                @keydown="moveByKeyboard($event, groups[gi].keys, groups[gi].keys.indexOf(row.key))"
              >
                <IconLucideGripVertical class="size-4" />
              </button>
              <component
                :is="row.icon"
                v-if="row.icon"
                class="size-4.5 shrink-0"
                :class="isHidden(row.key) ? 'opacity-40' : 'opacity-80'"
              />
              <span
                class="text-sm flex-1 min-w-0 truncate"
                :class="isHidden(row.key) ? 'opacity-40' : ''"
              >
                {{ row.label }}
              </span>
              <span v-if="row.featureOff" class="shrink-0 text-xs text-on-surface-variant/50">
                {{ t("settings.sidebarCustomize.featureDisabled") }}
              </span>
              <SButton
                v-if="row.hideable"
                variant="tertiary"
                :size="26"
                :icon-size="15"
                round
                @click="toggleHidden(row.key)"
              >
                <template #icon>
                  <IconLucideEyeOff v-if="isHidden(row.key)" />
                  <IconLucideEye v-else />
                </template>
              </SButton>
              <div v-else class="size-6.5 shrink-0" />
            </div>
            <div
              v-if="group.rows.length === 0"
              class="flex items-center justify-center h-9 rounded-lg border border-dashed border-on-surface/15 text-xs text-on-surface-variant/50"
            >
              {{ t("settings.sidebarCustomize.emptyGroup") }}
            </div>
          </div>
        </SCard>
      </div>
      <SButton variant="secondary" block size="small" @click="addGroup">
        <template #icon><IconLucidePlus /></template>
        {{ t("settings.sidebarCustomize.addGroup") }}
      </SButton>
      <div class="flex items-center justify-between px-1">
        <span class="text-sm">{{ t("settings.sidebarCustomize.keepEmptyDivider") }}</span>
        <SSwitch v-model="keepEmptyDivider" />
      </div>
      <div class="flex items-center justify-between px-1">
        <span class="text-sm">{{ t("settings.sidebarCustomize.nameWithDivider") }}</span>
        <SSwitch v-model="nameWithDivider" />
      </div>
      <span class="text-xs text-on-surface-variant/60 mt-1">
        {{ t("settings.sidebarCustomize.groups") }}
      </span>
      <div class="flex flex-col gap-2.5">
        <!-- 我的歌单 -->
        <SCard flush class="flex flex-col gap-1.5 p-2">
          <div
            class="flex items-center gap-2 px-1 min-h-6.5 cursor-pointer select-none"
            @click="expandedMy = !expandedMy"
          >
            <IconLucideChevronRight
              class="size-4 shrink-0 text-on-surface-variant/60 transition-transform duration-200"
              :class="expandedMy ? 'rotate-90' : ''"
            />
            <IconLucideListMusic
              class="size-4.5 shrink-0"
              :class="isHidden(SIDEBAR_GROUP_MY_PLAYLISTS) ? 'opacity-40' : 'opacity-80'"
            />
            <span
              class="text-sm flex-1 min-w-0 truncate"
              :class="isHidden(SIDEBAR_GROUP_MY_PLAYLISTS) ? 'opacity-40' : ''"
            >
              {{ t("collection.my", { type: t("collection.playlist") }) }}
            </span>
            <SButton
              variant="tertiary"
              :size="26"
              :icon-size="15"
              round
              @click.stop="toggleHidden(SIDEBAR_GROUP_MY_PLAYLISTS)"
            >
              <template #icon>
                <IconLucideEyeOff v-if="isHidden(SIDEBAR_GROUP_MY_PLAYLISTS)" />
                <IconLucideEye v-else />
              </template>
            </SButton>
          </div>
          <template v-if="expandedMy">
            <div class="flex items-center px-1 py-0.5">
              <SPopselect
                :model-value="mySource"
                :options="sourceOptions"
                side="bottom"
                align="start"
                @update:model-value="onMySourceChange"
              >
                <template #trigger>
                  <span
                    class="inline-flex items-center gap-1 text-xs text-on-surface-variant/70 hover:text-on-surface cursor-pointer leading-none transition-colors duration-200"
                  >
                    {{
                      mySource === "local"
                        ? t("collection.localPlaylist")
                        : t("collection.onlinePlaylist")
                    }}
                    <IconLucideChevronDown class="size-3" />
                  </span>
                </template>
              </SPopselect>
            </div>
            <div ref="myListEl" class="flex flex-col gap-1.5">
              <div
                v-for="row in myRows"
                :key="row.key"
                :data-playlist-key="row.key"
                :data-config-drag-id="row.key"
                class="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-on-surface/4"
              >
                <button
                  type="button"
                  class="item-handle flex size-7 items-center justify-center shrink-0 rounded bg-transparent border-none text-on-surface-variant/60 cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline-primary"
                  :aria-label="row.title"
                  @keydown="movePlaylistByKeyboard($event, row.key)"
                >
                  <IconLucideGripVertical class="size-4" />
                </button>
                <span
                  class="text-sm flex-1 min-w-0 truncate"
                  :class="isHidden(row.key) ? 'opacity-40' : ''"
                >
                  {{ row.title }}
                </span>
                <SButton
                  variant="tertiary"
                  :size="26"
                  :icon-size="15"
                  round
                  @click="toggleHidden(row.key)"
                >
                  <template #icon>
                    <IconLucideEyeOff v-if="isHidden(row.key)" />
                    <IconLucideEye v-else />
                  </template>
                </SButton>
              </div>
              <div
                v-if="myRows.length === 0"
                class="flex items-center justify-center h-9 rounded-lg border border-dashed border-on-surface/15 text-xs text-on-surface-variant/50"
              >
                {{ t("settings.sidebarCustomize.noPlaylists") }}
              </div>
            </div>
          </template>
        </SCard>
      </div>
    </div>
    <template #footer="{ close }">
      <SButton variant="secondary" @click="handleReset">{{ t("common.reset") }}</SButton>
      <SButton variant="secondary" @click="close">{{ t("common.cancel") }}</SButton>
      <SButton type="primary" @click="handleConfirm">{{ t("common.confirm") }}</SButton>
    </template>
  </SDialog>
</template>
