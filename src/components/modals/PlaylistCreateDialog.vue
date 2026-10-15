<script setup lang="ts">
import type { ContentScope } from "@/types/collection";
import { usePlaylistStore } from "@/stores/playlist";
import { toast } from "@/composables/useToast";

const props = defineProps<{
  open: boolean;
  /** 默认新建类型 */
  mode: ContentScope;
  /** 预填歌单名 */
  initialName?: string;
}>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  /** 新建成功：歌单 id + 实际类型 */
  created: [playlistId: string, scope: ContentScope];
}>();

const { t } = useI18n();
const playlistStore = usePlaylistStore();

const scope = ref<ContentScope>("local");
const name = ref("");
const submitting = ref(false);

const typeTabs = computed(() => [{ key: "local", label: t("collection.localPlaylist") }]);
const canSubmit = computed(() => Boolean(name.value.trim()));

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    scope.value = "local";
    name.value = props.initialName?.trim() ?? "";
    submitting.value = false;
  },
);

const handleConfirm = async (): Promise<void> => {
  const title = name.value.trim();
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    let id: string | undefined;
    id = (await playlistStore.create(title)).id;
    if (!id) {
      toast.error(t("liked.toast.failed"));
      return;
    }
    emit("created", id, scope.value);
    emit("update:open", false);
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : t("liked.toast.failed");
    toast.error(message);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <SDialog
    :open="open"
    :title="t('collection.create', { type: t('collection.playlist') })"
    width="480px"
    @update:open="(value) => emit('update:open', value)"
  >
    <STabs v-model="scope" :tabs="typeTabs" type="segment" animated>
      <template #local>
        <div class="flex flex-col gap-4 pt-4">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-on-surface-variant">
              {{ t("collection.name", { type: t("collection.playlist") }) }}
            </span>
            <SInput
              v-model="name"
              :placeholder="t('collection.playlistNamePlaceholder')"
              :disabled="submitting"
              clearable
              @keyup.enter="handleConfirm"
            />
          </label>
        </div>
      </template>
    </STabs>

    <template #footer="{ close }">
      <SButton variant="tertiary" :disabled="submitting" @click="close">
        {{ t("common.cancel") }}
      </SButton>
      <SButton type="primary" :disabled="!canSubmit" :loading="submitting" @click="handleConfirm">
        {{ t("common.confirm") }}
      </SButton>
    </template>
  </SDialog>
</template>
