<script setup lang="ts">
defineOptions({ name: "Home" });
import type { Track } from "@shared/types/player";
import { useLibraryStore } from "@/stores/library";
import HomeStats from "@/components/stats/HomeStats.vue";

import { useHomeHeader } from "@/composables/home/useHomeHeader";
import { useDailyRecommend } from "@/composables/home/useDailyRecommend";
import { useFloatingPlayerBar } from "@/composables/useFloatingPlayerBar";

const { t } = useI18n();
const { isFloatingBar } = useFloatingPlayerBar();

/** 头部 */
const { greetingTitle, headerStats, load: loadHeader } = useHomeHeader();
/** 重点推荐 */
const {
  hero,
  loading: heroLoading,
  previewTracks: heroPreview,
  playAll: playHero,
  addToQueue: addHeroToQueue,
  load: loadHero,
} = useDailyRecommend();
const library = useLibraryStore();
watch(
  () => library.tracks,
  () => {
    void loadHero();
  },
  { immediate: true },
);
onMounted(() => {
  void loadHeader();
});

/** 拼接歌手名 */
const artistName = (track: Track): string => track.artists.map((artist) => artist.name).join(" / ");

/** 序号补零为两位 */
const trackNo = (index: number): string => String(index + 1).padStart(2, "0");
</script>

<template>
  <div class="h-full overflow-y-auto [scrollbar-gutter:stable]">
    <div
      class="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 pt-6"
      :class="isFloatingBar ? 'pb-28' : 'pb-10'"
    >
      <!-- 问候 -->
      <header class="flex items-start justify-between gap-6">
        <div class="min-w-0">
          <h1 class="text-3xl font-bold text-on-surface text-balance">{{ greetingTitle }}</h1>
        </div>
        <div class="shrink-0 flex items-center gap-6">
          <div v-for="stat in headerStats" :key="stat.label" class="text-right">
            <div class="flex items-baseline justify-end gap-0.5">
              <span class="text-2xl font-bold text-on-surface tabular-nums">{{ stat.value }}</span>
              <span class="text-sm text-on-surface-variant">{{ stat.unit }}</span>
            </div>
            <div class="mt-0.5 text-xs text-on-surface-variant/50">{{ stat.label }}</div>
          </div>
        </div>
      </header>
      <p
        v-if="library.scanning"
        role="status"
        class="flex items-center gap-2 text-sm text-on-surface-variant"
      >
        <SLoading class="size-4" />
        {{
          t("library.scanProgress", {
            scanned: library.scanProgress?.scanned ?? 0,
            total: library.scanProgress?.total ?? 0,
          })
        }}
      </p>
      <!-- Hero -->
      <SCard v-if="heroLoading || hero" radius="xl" flush class="min-h-40">
        <div class="flex items-stretch gap-4 p-4">
          <!-- 封面 -->
          <div class="size-32 shrink-0 self-center overflow-hidden rounded-lg">
            <SImg :src="hero?.cover" :alt="hero?.title" class="size-full" />
          </div>
          <!-- 信息 -->
          <div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <STag v-if="hero" type="default" round size="small" class="self-start">
              {{ hero.tag }}
            </STag>
            <h2 class="truncate text-xl font-bold text-on-surface">{{ hero?.title }}</h2>
            <p class="truncate text-sm text-on-surface-variant/70">{{ hero?.subtitle }}</p>
            <div class="mt-0.5 flex items-center gap-2">
              <SButton type="primary" round :disabled="heroLoading" @click="playHero">
                <template #icon><IconLucidePlay /></template>
                {{ t("home.hero.play") }}
              </SButton>
              <SButton variant="secondary" round :disabled="heroLoading" @click="addHeroToQueue">
                <template #icon><IconLucidePlus /></template>
                {{ t("home.hero.addQueue") }}
              </SButton>
            </div>
          </div>
          <!-- 队列预览 -->
          <ul
            v-if="heroPreview.length > 0"
            class="hidden w-80 shrink-0 flex-col border-l border-on-surface/8 pl-4 xl:flex"
          >
            <li
              v-for="(track, index) in heroPreview"
              :key="`${track.source}:${track.id}`"
              class="flex flex-1 items-center gap-2.5"
            >
              <span class="w-5 shrink-0 text-xs tabular-nums text-on-surface-variant/35">
                {{ trackNo(index) }}
              </span>
              <span class="flex-1 truncate text-sm text-on-surface">{{ track.title }}</span>
              <span class="max-w-24 shrink-0 truncate text-xs text-on-surface-variant/45">
                {{ artistName(track) }}
              </span>
            </li>
          </ul>
        </div>
      </SCard>
      <HomeStats />
    </div>
  </div>
</template>
