<script setup lang="ts">
import { createSettingsDragSort } from "@/composables/useSettingsDragSort";
import { useSettingsStore } from "@/stores/settings";
import {
  SONG_LIST_COLUMNS,
  SONG_LIST_COLUMN_LABELS,
  type SongListColumn,
} from "@/utils/songListColumns";

defineOptions({ inheritAttrs: false });
const { t } = useI18n();
const settings = useSettingsStore();
const open = ref(false);
const order = ref<SongListColumn[]>([]);
const hidden = ref<SongListColumn[]>([]);
const listEl = ref<HTMLElement | null>(null);

watch(open, (value) => {
  if (!value) return;
  order.value = [...settings.appearance.songListColumnOrder];
  hidden.value = [...settings.appearance.songListHiddenColumns];
});

/** Move a built-in column within the dialog's unsaved layout.
 * @param column - Column to move.
 * @param target - Destination index.
 */
const moveColumn = (column: SongListColumn, target: number): void => {
  if (target < 0 || target >= order.value.length) return;
  const next = [...order.value];
  next.splice(next.indexOf(column), 1);
  next.splice(target, 0, column);
  order.value = next;
};

/** Reorder from a keyboard-accessible drag handle and restore its focus.
 * @param event - Arrow-key input.
 * @param column - Focused column.
 */
const onHandleKeydown = async (event: KeyboardEvent, column: SongListColumn): Promise<void> => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  moveColumn(column, order.value.indexOf(column) + (event.key === "ArrowUp" ? -1 : 1));
  await nextTick();
  listEl.value?.querySelector<HTMLButtonElement>(`[data-column-handle="${column}"]`)?.focus();
};

watch([listEl, open], ([element, isOpen], _, onCleanup) => {
  if (!element || !isOpen) return;
  const sortable = createSettingsDragSort(element, {
    handle: "[data-column-handle]",
    draggable: "[data-column-key]",
    onEnd: ({ oldDraggableIndex, newDraggableIndex }) => {
      if (oldDraggableIndex == null || newDraggableIndex == null) return;
      moveColumn(order.value[oldDraggableIndex], newDraggableIndex);
    },
  });
  onCleanup(() => sortable.destroy());
});

/** Toggle only optional built-in columns.
 * @param column - Column whose visibility changes.
 * @param visible - Whether the column should be shown.
 */
const setVisible = (column: SongListColumn, visible: boolean): void => {
  if (column === "title") return;
  hidden.value = visible
    ? hidden.value.filter((key) => key !== column)
    : [...hidden.value.filter((key) => key !== column), column];
};

/** Restore the default layout in the draft without saving it. */
const reset = (): void => {
  order.value = [...SONG_LIST_COLUMNS];
  hidden.value = [];
};

/** Save the draft through the persistent appearance store. */
const save = (): void => {
  settings.appearance.songListColumnOrder = [...order.value];
  settings.appearance.songListHiddenColumns = [...hidden.value];
  open.value = false;
};
</script>

<template>
  <SButton type="primary" variant="secondary" size="small" @click="open = true">
    {{ t("common.configure") }}
  </SButton>
  <SDialog
    v-model:open="open"
    :title="t('settings.songListColumns.label')"
    :description="t('settings.songListColumns.hint')"
    width="min(460px, calc(100vw - 32px))"
  >
    <div ref="listEl" class="flex flex-col gap-2">
      <div
        v-for="column in order"
        :key="column"
        :data-column-key="column"
        :data-config-drag-id="column"
        class="flex items-center gap-3 rounded-lg bg-on-surface/4 px-3 py-2"
      >
        <button
          type="button"
          :data-column-handle="column"
          :aria-label="
            t('settings.songListColumns.reorder', { column: t(SONG_LIST_COLUMN_LABELS[column]) })
          "
          class="flex size-9 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-on-surface-variant cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline-primary"
          @keydown="onHandleKeydown($event, column)"
        >
          <IconLucideGripVertical class="size-4" />
        </button>
        <span class="flex-1 min-w-0 text-sm">{{ t(SONG_LIST_COLUMN_LABELS[column]) }}</span>
        <span v-if="column === 'title'" class="text-xs text-on-surface-variant">
          {{ t("settings.songListColumns.required") }}
        </span>
        <SSwitch
          :model-value="!hidden.includes(column)"
          :disabled="column === 'title'"
          :aria-label="t(SONG_LIST_COLUMN_LABELS[column])"
          @update:model-value="setVisible(column, $event)"
        />
      </div>
    </div>
    <template #footer="{ close }">
      <SButton variant="secondary" @click="reset">{{ t("common.reset") }}</SButton>
      <SButton variant="secondary" @click="close">{{ t("common.cancel") }}</SButton>
      <SButton type="primary" @click="save">{{ t("common.confirm") }}</SButton>
    </template>
  </SDialog>
</template>
