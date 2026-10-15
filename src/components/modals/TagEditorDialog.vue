<script setup lang="ts">
import type { Track } from "@shared/types/player";
import type { TrackTags, TagEditRequest } from "@shared/types/tagEditor";
import * as player from "@/core/player";
import { toast } from "@/composables/useToast";
import { handleError } from "@/utils/errors";
import { formatFileSize } from "@/utils/format";

const props = defineProps<{ open: boolean; track: Track | null }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const { t } = useI18n();

/** 文件名 */
const fileName = computed(
  () => (props.track?.cueAudioPath ?? props.track?.path)?.split(/[/\\]/).pop() ?? "",
);

/** 格式 · 大小 摘要行 */
const fileMeta = computed(() => {
  const parts: string[] = [];
  const codec = props.track?.quality?.codec;
  if (codec) parts.push(codec.toUpperCase());
  const size = props.track?.fileSize;
  if (size) parts.push(formatFileSize(size));
  return parts.join(" · ");
});

/** 文件读出的原始标签快照 */
const original = shallowRef<TrackTags | null>(null);
const loading = ref(false);
const saving = ref(false);

/** 表单状态 */
const form = reactive({
  title: "",
  artist: "",
  album: "",
  albumArtist: "",
  genre: "",
  year: null as number | null,
  trackNumber: null as number | null,
  discNumber: null as number | null,
  lyrics: "",
});

/** 新封面 */
const newCoverPath = ref<string | null>(null);
const newCoverPreview = ref<string | null>(null);

/**
 * 重置表单为指定标签的值
 * @param tags 要回填的标签，null 表示重置为初始状态（全空）
 */
const resetForm = (tags: TrackTags | null): void => {
  form.title = tags?.title ?? "";
  form.artist = tags?.artist ?? "";
  form.album = tags?.album ?? "";
  form.albumArtist = tags?.albumArtist ?? "";
  form.genre = tags?.genre ?? "";
  form.year = tags?.year ?? null;
  form.trackNumber = tags?.trackNumber ?? null;
  form.discNumber = tags?.discNumber ?? null;
  form.lyrics = tags?.lyrics ?? "";
  newCoverPath.value = null;
  newCoverPreview.value = null;
};

/** 打开时读取文件标签回填 */
watch(
  () => props.open,
  async (open) => {
    if (!open || !props.track?.path || props.track.cuePath) return;
    loading.value = true;
    original.value = null;
    resetForm(null);
    const result = await window.api.library.readTags(props.track.path);
    loading.value = false;
    if (!result.success || !result.data) {
      if (result.error) handleError(result.error);
      emit("update:open", false);
      return;
    }
    original.value = result.data;
    resetForm(result.data);
  },
);

/** 选择新封面 */
const pickCover = async (): Promise<void> => {
  const result = await window.api.library.pickCoverImage();
  if (!result.success || !result.data) return;
  newCoverPath.value = result.data.path;
  newCoverPreview.value = result.data.dataUrl;
};

/** 文本字段 diff */
const diffText = (origValue: string | undefined, current: string): string | undefined => {
  return (origValue ?? "") === current ? undefined : current;
};

/** 数字字段 diff */
const diffNumber = (origValue: number | undefined, current: number | null): number | undefined => {
  const next = current ?? 0;
  return (origValue ?? 0) === next ? undefined : next;
};

/** 保存标签 */
const handleSave = async (): Promise<void> => {
  const track = props.track;
  const tags = original.value;
  if (!track?.path || !tags || saving.value) return;
  // 构造编辑请求，仅包含变更的字段
  const edit: TagEditRequest = {
    path: track.path,
    title: diffText(tags.title, form.title.trim()),
    artist: diffText(tags.artist, form.artist.trim()),
    album: diffText(tags.album, form.album.trim()),
    albumArtist: diffText(tags.albumArtist, form.albumArtist.trim()),
    genre: diffText(tags.genre, form.genre.trim()),
    year: diffNumber(tags.year, form.year),
    trackNumber: diffNumber(tags.trackNumber, form.trackNumber),
    discNumber: diffNumber(tags.discNumber, form.discNumber),
    lyrics: diffText(tags.lyrics, form.lyrics),
    coverPath: newCoverPath.value ?? undefined,
  };
  // 如果没有任何变更，直接关闭对话框
  const changed = Object.entries(edit).some(
    ([key, value]) => key !== "path" && value !== undefined,
  );
  if (!changed) {
    emit("update:open", false);
    return;
  }
  // 批量写入标签
  saving.value = true;
  const outcomes = await player.saveTrackTags([edit]);
  saving.value = false;
  const outcome = outcomes?.[0];
  if (outcome?.success) {
    toast.success(t("tagEditor.saveSuccess"));
    emit("update:open", false);
  } else if (outcome?.error) {
    toast.error(`${t("tagEditor.saveFailed")}: ${outcome.error}`);
  }
};
</script>

<template>
  <SDialog
    :open="open"
    :title="t('tagEditor.title')"
    width="560px"
    @update:open="emit('update:open', $event)"
  >
    <div class="flex flex-col gap-4">
      <!-- 封面 -->
      <div class="flex items-stretch gap-4">
        <SImg
          :src="newCoverPreview ?? track?.cover"
          class="size-24 shrink-0 rounded-lg overflow-hidden"
        />
        <div class="flex flex-col justify-between min-w-0 py-0.5">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm font-medium truncate" :title="fileName">{{ fileName }}</span>
            <span class="text-xs text-on-surface-variant/70 truncate" :title="track?.path">
              {{ track?.path }}
            </span>
            <span v-if="fileMeta" class="text-xs text-on-surface-variant/70">{{ fileMeta }}</span>
          </div>
          <SButton variant="secondary" size="small" class="w-fit" @click="pickCover">
            {{ t("tagEditor.replaceCover") }}
          </SButton>
        </div>
      </div>
      <!-- 文本标签 -->
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 col-span-2">
          <span class="text-xs text-on-surface-variant">{{ t("tagEditor.fields.title") }}</span>
          <SInput v-model="form.title" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">{{ t("tagEditor.fields.artist") }}</span>
          <SInput v-model="form.artist" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">
            {{ t("tagEditor.fields.albumArtist") }}
          </span>
          <SInput v-model="form.albumArtist" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">{{ t("tagEditor.fields.album") }}</span>
          <SInput v-model="form.album" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">{{ t("tagEditor.fields.genre") }}</span>
          <SInput v-model="form.genre" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant">{{ t("tagEditor.fields.year") }}</span>
          <SNumberInput v-model="form.year" :min="0" :max="9999" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-on-surface-variant">
              {{ t("tagEditor.fields.trackNumber") }}
            </span>
            <SNumberInput v-model="form.trackNumber" :min="0" :max="9999" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-on-surface-variant">
              {{ t("tagEditor.fields.discNumber") }}
            </span>
            <SNumberInput v-model="form.discNumber" :min="0" :max="999" />
          </label>
        </div>
      </div>
      <!-- 内嵌歌词 -->
      <label class="flex flex-col gap-1">
        <span class="text-xs text-on-surface-variant">{{ t("tagEditor.fields.lyrics") }}</span>
        <SInput
          v-model="form.lyrics"
          type="textarea"
          :rows="6"
          resize="vertical"
          :placeholder="t('tagEditor.lyricsPlaceholder')"
        />
      </label>
    </div>
    <template #footer>
      <SButton variant="secondary" :disabled="saving" @click="emit('update:open', false)">
        {{ t("common.cancel") }}
      </SButton>
      <SButton :loading="saving" :disabled="loading" @click="handleSave">
        {{ t("common.save") }}
      </SButton>
    </template>
  </SDialog>
</template>
