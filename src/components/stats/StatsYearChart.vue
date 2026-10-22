<script setup lang="ts">
import type { Track } from "@shared/types/player";
import { countTrackYears } from "@shared/utils/year";

const props = defineProps<{ tracks: Track[] }>();
const { t } = useI18n();
const viewport = useTemplateRef<HTMLElement>("viewport");
const { width: viewportWidth } = useElementSize(viewport);
const counts = computed(() => countTrackYears(props.tracks));
const unknown = computed(
  () => props.tracks.length - counts.value.reduce((sum, entry) => sum + entry.count, 0),
);
const span = computed(() =>
  counts.value.length ? counts.value[counts.value.length - 1].year - counts.value[0].year : 0,
);
const width = computed(() => Math.max(viewportWidth.value, (span.value + 1) * 64, 128));
const maximum = computed(() => Math.max(1, ...counts.value.map((entry) => entry.count)));
const points = computed(() =>
  counts.value.map((entry) => ({
    ...entry,
    x: span.value
      ? 32 + ((entry.year - counts.value[0].year) * (width.value - 64)) / span.value
      : width.value / 2,
    y: 154 - (entry.count / maximum.value) * 112,
  })),
);
const line = computed(() =>
  points.value
    .map((point, i, all) => {
      if (!i) return `M ${point.x} ${point.y}`;
      const previous = all[i - 1];
      const middle = (previous.x + point.x) / 2;
      return `C ${middle} ${previous.y} ${middle} ${point.y} ${point.x} ${point.y}`;
    })
    .join(" "),
);
</script>

<template>
  <SCard radius="xl" class="flex h-60 min-w-0 flex-col gap-2" data-year-chart>
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-base font-semibold">{{ t("year.distribution") }}</h3>
      <span v-if="unknown" class="text-xs text-on-surface-variant/60">
        {{ t("year.missing", { count: unknown }) }}
      </span>
    </div>
    <div
      ref="viewport"
      tabindex="0"
      class="min-h-0 min-w-0 flex-1 overflow-x-auto rounded focus-visible:ring-1 focus-visible:ring-primary/40"
      :aria-label="t('year.distribution')"
    >
      <svg
        v-if="points.length"
        :width="width"
        height="188"
        role="img"
        :aria-label="t('year.distribution')"
        class="text-primary"
      >
        <path
          v-if="points.length > 1"
          :d="`${line} L ${points[points.length - 1].x} 154 L ${points[0].x} 154 Z`"
          class="fill-primary/5"
        />
        <path :d="line" fill="none" stroke="currentColor" stroke-width="2.5" />
        <g v-for="point in points" :key="point.year">
          <circle :cx="point.x" :cy="point.y" r="4" fill="currentColor">
            <title>{{ point.year }}: {{ point.count }}</title>
          </circle>
          <text
            :x="point.x"
            :y="point.y - 13"
            text-anchor="middle"
            class="fill-on-surface-variant text-xs tabular-nums"
          >
            {{ point.count }}
          </text>
          <text
            :x="point.x"
            y="182"
            text-anchor="middle"
            class="fill-on-surface-variant text-xs font-semibold tabular-nums"
          >
            {{ point.year }}
          </text>
        </g>
      </svg>
      <p v-else class="flex h-full items-center justify-center text-sm text-on-surface-variant/60">
        {{ t("stats.noDataHint") }}
      </p>
    </div>
    <table class="sr-only">
      <caption>{{ t("year.distribution") }}</caption>
      <thead>
        <tr>
          <th>{{ t("year.singular") }}</th>
          <th>{{ t("search.tabs.songs") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in counts" :key="entry.year">
          <td>{{ entry.year }}</td>
          <td>{{ entry.count }}</td>
        </tr>
      </tbody>
    </table>
  </SCard>
</template>
