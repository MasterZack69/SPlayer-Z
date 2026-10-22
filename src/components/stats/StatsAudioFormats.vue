<script setup lang="ts">
import type { LibraryStats } from "@shared/types/stats";
import { isLosslessCodec } from "@/utils/quality";
import StatsDonutChart from "./StatsDonutChart.vue";
const props = defineProps<{ stats: LibraryStats | null; loading: boolean }>();
const { t } = useI18n();
interface CodecVisual {
  id: string;
  codec: string;
  count: number;
  percent: number;
  opacity: number;
}

const codecs = computed(() => (props.stats?.codecs ?? []).filter((item) => item.codec.trim()));
const chartCodecs = computed(() => codecs.value.slice(0, 4));
const totalCodecCount = computed(() =>
  chartCodecs.value.reduce((sum, item) => sum + item.count, 0),
);

/** Derive codec shares from the displayed library snapshot. */
const codecVisuals = computed<CodecVisual[]>(() => {
  return chartCodecs.value.map((item, index) => ({
    ...item,
    id: item.codec,
    percent: totalCodecCount.value ? (item.count / totalCodecCount.value) * 100 : 0,
    opacity: Math.max(0.24, 0.92 - index * 0.14),
  }));
});

const losslessCount = computed(() =>
  chartCodecs.value.reduce((sum, item) => sum + (isLosslessCodec(item.codec) ? item.count : 0), 0),
);

const losslessPercent = computed(() =>
  totalCodecCount.value ? (losslessCount.value / totalCodecCount.value) * 100 : 0,
);

/** Format a codec count as a share of the represented formats.
 * @param count - Tracks using this codec.
 */
const codecPercent = (count: number): string => {
  if (!totalCodecCount.value) return "0%";
  return `${((count / totalCodecCount.value) * 100).toFixed(1)}%`;
};

/** Label a codec without exposing an empty format name.
 * @param codec - Audio codec from the index.
 */
const codecLabel = (codec: string): string => {
  return codec ? codec.toUpperCase() : t("stats.unknown");
};
</script>
<template>
  <!-- Audio formats retain their existing library-based distribution. -->
  <SCard radius="xl" class="flex h-60 min-w-0 flex-col gap-3">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-base font-semibold text-on-surface">
        {{ t("stats.audioQuality") }}
      </h3>
      <span class="text-xs text-on-surface-variant/45 tabular-nums">
        {{ loading ? "--" : t("stats.formatCount", { count: chartCodecs.length }) }}
      </span>
    </div>

    <div
      v-if="!loading && chartCodecs.length > 0"
      class="mx-auto flex min-h-0 w-full max-w-[520px] flex-1 items-center gap-4"
    >
      <StatsDonutChart :segments="codecVisuals">
        <span class="text-[10px] text-on-surface-variant/55">
          {{ t("stats.losslessRatio") }}
        </span>
        <span class="mt-1 text-xl font-bold leading-none text-on-surface tabular-nums">
          {{ losslessPercent.toFixed(1) }}%
        </span>
      </StatsDonutChart>

      <div class="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-3">
        <div
          v-for="codec in codecVisuals"
          :key="codec.codec"
          class="grid min-w-0 grid-cols-[0.5rem_minmax(0,1fr)] items-center gap-2"
        >
          <span class="size-2 rounded-full bg-primary" :style="{ opacity: codec.opacity }" />
          <div class="min-w-0">
            <div class="truncate text-xs font-medium text-on-surface">
              {{ codecLabel(codec.codec) }}
            </div>
            <div class="truncate text-[10px] text-on-surface-variant/50 tabular-nums">
              {{ codec.count }} {{ t("stats.trackUnit") }} · {{ codecPercent(codec.count) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="flex min-h-0 flex-1 items-center justify-center">
      <SLoading class="size-6 text-primary/60" />
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-on-surface-variant/40"
    >
      <IconLucideMusic class="size-7" />
      <span class="text-sm">{{ t("stats.noDataHint") }}</span>
    </div>
  </SCard>
</template>
