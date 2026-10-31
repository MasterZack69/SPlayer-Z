<script setup lang="ts">
import type { PlaybackContext, Track } from "@shared/types/player";
import { useShuffleAll } from "@/composables/useShuffleAll";
import SButton from "@/components/ui/SButton.vue";
import SDropdownMenu from "@/components/ui/SDropdownMenu.vue";
import IconLucidePlay from "~icons/lucide/play";
import IconLucideEllipsis from "~icons/lucide/ellipsis";
import * as player from "@/core/player";

const props = defineProps<{ items: readonly Track[]; context?: PlaybackContext }>();
const { t } = useI18n();
const { shuffleAllItem, shuffleAll } = useShuffleAll(
  () => props.items,
  () => props.context,
);

/** Replace the queue and play the displayed order, independently of shuffle mode. */
const playAll = (): void => {
  if (props.items.length)
    void player.playFrom(props.items, { context: props.context, shuffle: false });
};
</script>

<template>
  <div class="flex items-center gap-3">
    <SButton type="primary" variant="secondary" round :disabled="!items.length" @click="playAll">
      <template #icon><IconLucidePlay /></template>
      {{ t("common.playAll") }}
    </SButton>
    <SDropdownMenu :items="[shuffleAllItem]" align="start" @select="shuffleAll">
      <template #trigger>
        <SButton
          variant="secondary"
          circle
          :disabled="!items.length"
          :aria-label="t('collection.context.more')"
        >
          <template #icon><IconLucideEllipsis /></template>
        </SButton>
      </template>
    </SDropdownMenu>
  </div>
</template>
