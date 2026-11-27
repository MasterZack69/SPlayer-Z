<script setup lang="ts">
import type { AudioAnalysis } from "@shared/types/analysis";
import { analysisTrack } from "@/services/analysisSelection";

defineOptions({ name: "AnalyzePage" });

const { t } = useI18n();
const result = shallowRef<AudioAnalysis | null>(null);
const loading = ref(false);
const error = ref("");
const canvas = shallowRef<HTMLCanvasElement | null>(null);
const zoom = ref(1);
const pan = ref(0);
const cursor = ref<{
  timeMs: number;
  frequencyHz: number;
  levelDb: number;
  x: number;
  y: number;
} | null>(null);
let heatmap: HTMLCanvasElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let requestId = 0;

const track = analysisTrack;
const artist = computed(() => track.value?.artists.map((item) => item.name).join(", ") || "—");
const metrics = computed(() => {
  const data = result.value;
  if (!data) return [];
  return [
    { label: t("analysis.peak"), value: `${data.peakDb.toFixed(1)} dBFS` },
    { label: t("analysis.rms"), value: `${data.rmsDb.toFixed(1)} dBFS` },
    { label: t("analysis.crest"), value: `${data.crestDb.toFixed(1)} dB` },
    { label: t("analysis.clips"), value: data.clippedSamples.toLocaleString() },
  ];
});
const verdictDetail = computed(() => {
  const data = result.value;
  if (!data) return "";
  if (data.verdict === "genuine" && data.cutoffHz) {
    return t("analysis.contentReaches", { frequency: formatFrequency(data.cutoffHz) });
  }
  return t("analysis.verdictDetails." + data.verdict);
});
const evidenceLevel = computed(() => {
  const score = result.value?.verdictConfidence ?? 0;
  if (score >= 80) return t("analysis.evidenceLevels.strong");
  if (score >= 55) return t("analysis.evidenceLevels.moderate");
  return t("analysis.evidenceLevels.limited");
});
const timeRange = computed(() => {
  const duration = result.value?.durationMs ?? 0;
  const span = duration / zoom.value;
  const start = (duration - span) * pan.value;
  return { start, middle: start + span / 2, end: start + span };
});

/** Format a frequency for spectral labels and hover readouts.
 * @param hz - Frequency in hertz.
 * @returns Compact frequency label.
 */
const formatFrequency = (hz: number): string =>
  hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz` : `${Math.round(hz)} Hz`;

/** Format elapsed analysis time in minutes and seconds.
 * @param milliseconds - Position in the analyzed range.
 * @returns Clock label.
 */
const formatTime = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Map a quantized spectral level to the page's thermal color scale.
 * @param level - Quantized level between zero and 255.
 * @returns RGB components.
 */
const colorForLevel = (level: number): [number, number, number] => {
  const stops: [number, number, number][] = [
    [8, 8, 26],
    [34, 13, 76],
    [99, 18, 133],
    [184, 28, 104],
    [247, 65, 43],
    [255, 147, 27],
    [255, 220, 67],
  ];
  const scaled = (level / 255) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  return [0, 1, 2].map((channel) =>
    Math.round(stops[index][channel] * (1 - fraction) + stops[index + 1][channel] * fraction),
  ) as [number, number, number];
};

/** Build a bounded image from the native column-major spectrogram.
 * @param data - Native analysis output.
 */
const buildHeatmap = (data: AudioAnalysis): void => {
  heatmap = document.createElement("canvas");
  heatmap.width = data.columns;
  heatmap.height = data.bins;
  const context = heatmap.getContext("2d");
  if (!context) return;
  const image = context.createImageData(data.columns, data.bins);
  for (let x = 0; x < data.columns; x++) {
    for (let y = 0; y < data.bins; y++) {
      const level = data.spectrogram[x * data.bins + y];
      const [red, green, blue] = colorForLevel(level);
      const pixel = ((data.bins - 1 - y) * data.columns + x) * 4;
      image.data[pixel] = red;
      image.data[pixel + 1] = green;
      image.data[pixel + 2] = blue;
      image.data[pixel + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
};

/** Draw the visible time span at the current zoom and pan position. */
const draw = (): void => {
  const target = canvas.value;
  const data = result.value;
  if (!target || !data || !heatmap) return;
  const bounds = target.getBoundingClientRect();
  if (bounds.width <= 0) return;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  target.width = Math.round(bounds.width * scale);
  target.height = Math.round(bounds.height * scale);
  const context = target.getContext("2d");
  if (!context) return;
  const visible = Math.max(1, Math.ceil(data.columns / zoom.value));
  const first = Math.round((data.columns - visible) * pan.value);
  context.imageSmoothingEnabled = true;
  context.drawImage(heatmap, first, 0, visible, data.bins, 0, 0, target.width, target.height);
};

/** Show time, frequency and level at the pointer position.
 * @param event - Pointer movement over the spectrogram.
 */
const inspect = (event: PointerEvent): void => {
  const target = canvas.value;
  const data = result.value;
  if (!target || !data) return;
  const bounds = target.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
  const visible = Math.max(1, Math.ceil(data.columns / zoom.value));
  const first = Math.round((data.columns - visible) * pan.value);
  const column = Math.min(data.columns - 1, first + Math.floor(x * visible));
  const bin = Math.min(data.bins - 1, Math.floor((1 - y) * data.bins));
  cursor.value = {
    timeMs: (column / Math.max(1, data.columns - 1)) * data.durationMs,
    frequencyHz: (bin / Math.max(1, data.bins - 1)) * (data.sampleRate / 2),
    levelDb: (data.spectrogram[column * data.bins + bin] / 255) * 110 - 110,
    x: x * 100,
    y: y * 100,
  };
};

/** Change the spectrogram time scale while preserving the selected center.
 * @param factor - Multiplier for the current zoom.
 */
const changeZoom = (factor: number): void => {
  const oldSpan = 1 / zoom.value;
  const center = pan.value * (1 - oldSpan) + oldSpan / 2;
  zoom.value = Math.max(1, Math.min(8, zoom.value * factor));
  const newSpan = 1 / zoom.value;
  pan.value = newSpan === 1 ? 0 : Math.max(0, Math.min(1, (center - newSpan / 2) / (1 - newSpan)));
};

watch([result, zoom, pan], () => nextTick(draw));
watch(canvas, (target) => {
  resizeObserver?.disconnect();
  if (target) resizeObserver?.observe(target);
  draw();
});
watch(
  track,
  async (selected) => {
    const current = ++requestId;
    result.value = null;
    heatmap = null;
    error.value = "";
    zoom.value = 1;
    pan.value = 0;
    if (!selected) return;
    loading.value = true;
    try {
      const measured = await window.api.analysis.analyze(toRaw(selected));
      if (current !== requestId) return;
      result.value = measured;
      buildHeatmap(measured);
      await nextTick();
      draw();
    } catch {
      if (current === requestId) error.value = t("analysis.failed");
    } finally {
      if (current === requestId) loading.value = false;
    }
  },
  { immediate: true },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(draw);
  if (canvas.value) resizeObserver.observe(canvas.value);
});
onBeforeUnmount(() => {
  requestId++;
  resizeObserver?.disconnect();
  heatmap = null;
  void window.api.analysis.cancel();
});
</script>

<template>
  <div class="analysis-page">
    <div class="analysis-wrap">
      <div v-if="!track" class="empty-state">{{ t("analysis.noTrack") }}</div>
      <template v-else>
        <header class="analysis-header">
          <div class="header-copy">
            <h1>{{ t("analysis.title") }}</h1>
            <div class="track-meta">
              <img v-if="track.cover" :src="track.cover" alt="" decoding="async" />
              <div v-else class="cover-placeholder"><IconLucideMusic2 class="size-7" /></div>
              <div class="min-w-0">
                <strong>{{ track.title }}</strong>
                <span>
                  {{ artist }}
                  <template v-if="track.album">· {{ track.album.name }}</template>
                </span>
              </div>
            </div>
          </div>
        </header>

        <div v-if="loading" class="loading-state">
          <div class="loading-bars" aria-hidden="true">
            <span v-for="index in 7" :key="index" />
          </div>
          <strong>{{ t("analysis.loading") }}</strong>
          <small>{{ t("analysis.loadingDetail") }}</small>
        </div>
        <div v-else-if="error" class="empty-state">{{ error }}</div>

        <template v-else-if="result">
          <section class="verdict-card" :aria-label="t('analysis.verdict')">
            <div>
              <span class="eyebrow">{{ t("analysis.verdict") }}</span>
              <h2>{{ t("analysis.verdicts." + result.verdict) }}</h2>
              <p>{{ verdictDetail }}</p>
            </div>
            <div class="verdict-evidence">
              <span v-if="result.cutoffHz">
                {{
                  t(
                    result.verdict === "genuine" || result.verdict === "hiRes"
                      ? "analysis.observedEdge"
                      : "analysis.cutoff",
                  )
                }}
                · {{ formatFrequency(result.cutoffHz) }}
              </span>
              <span v-if="result.verdictConfidence && result.sectionsJudged">
                {{ t("analysis.sections") }} · {{ result.sectionsAgreeing }}/{{
                  result.sectionsJudged
                }}
              </span>
              <span v-if="result.verdictConfidence">
                {{ t("analysis.confidence") }} · {{ evidenceLevel }}
              </span>
            </div>
          </section>
          <section class="metrics" :aria-label="t('analysis.measurements')">
            <div v-for="metric in metrics" :key="metric.label" class="metric">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </section>

          <section class="spectrum-card">
            <div class="section-heading">
              <div>
                <h2>{{ t("analysis.spectrogram") }}</h2>
              </div>
              <div class="zoom-controls">
                <button
                  type="button"
                  :aria-label="t('analysis.zoomOut')"
                  :disabled="zoom <= 1"
                  @click="changeZoom(0.5)"
                >
                  −
                </button>
                <span>{{ zoom }}×</span>
                <button
                  type="button"
                  :aria-label="t('analysis.zoomIn')"
                  :disabled="zoom >= 8"
                  @click="changeZoom(2)"
                >
                  +
                </button>
              </div>
            </div>
            <div class="chart-area">
              <div class="frequency-labels">
                <span>{{ formatFrequency(result.sampleRate / 2) }}</span>
                <span>{{ formatFrequency((result.sampleRate * 3) / 8) }}</span>
                <span>{{ formatFrequency(result.sampleRate / 4) }}</span>
                <span>{{ formatFrequency(result.sampleRate / 8) }}</span>
                <span>0 Hz</span>
              </div>
              <div class="canvas-wrap">
                <canvas
                  ref="canvas"
                  :aria-label="t('analysis.spectrogram')"
                  @pointermove="inspect"
                  @pointerleave="cursor = null"
                />
                <template v-if="cursor">
                  <div class="crosshair crosshair-vertical" :style="{ left: cursor.x + '%' }" />
                  <div class="crosshair crosshair-horizontal" :style="{ top: cursor.y + '%' }" />
                </template>
                <div v-if="cursor" class="cursor-readout">
                  {{ formatTime(cursor.timeMs) }} · {{ formatFrequency(cursor.frequencyHz) }} ·
                  {{ cursor.levelDb.toFixed(0) }} dB
                </div>
              </div>
            </div>
            <div class="time-axis">
              <span>{{ formatTime(timeRange.start) }}</span>
              <span>{{ formatTime(timeRange.middle) }}</span>
              <span>{{ formatTime(timeRange.end) }}</span>
            </div>
            <input
              v-if="zoom > 1"
              v-model.number="pan"
              class="pan-range"
              type="range"
              min="0"
              max="1"
              step="0.001"
              :aria-label="t('analysis.pan')"
            />
            <div class="spectrum-footer">
              <span>{{ t("analysis.quiet") }}</span>
              <div class="color-key" />
              <span>{{ t("analysis.loud") }}</span>
              <span class="spectral-note">{{ t("analysis.hoverHint") }}</span>
            </div>
          </section>

          <section class="detail-grid">
            <div class="detail-card">
              <span class="eyebrow">{{ t("analysis.source") }}</span>
              <h2>{{ t("analysis.format") }}</h2>
              <div class="detail-row">
                <span>{{ t("analysis.codec") }}</span>
                <strong>{{ result.codec || "—" }}</strong>
              </div>
              <div class="detail-row">
                <span>{{ t("analysis.sampleRate") }}</span>
                <strong>{{ formatFrequency(result.sampleRate) }}</strong>
              </div>
              <div class="detail-row">
                <span>{{ t("analysis.channels") }}</span>
                <strong>{{ result.channels }}</strong>
              </div>
              <div class="detail-row">
                <span>{{ t("analysis.bitDepth") }}</span>
                <strong>{{ result.bitDepth ? `${result.bitDepth} bit` : "—" }}</strong>
              </div>
              <div class="detail-row">
                <span>{{ t("analysis.bitRate") }}</span>
                <strong>
                  {{ result.bitRate ? `${Math.round(result.bitRate / 1000)} kb/s` : "—" }}
                </strong>
              </div>
              <div class="detail-row">
                <span>{{ t("analysis.upperBand") }}</span>
                <strong>
                  {{ result.upperBandHz ? formatFrequency(result.upperBandHz) : "—" }}
                </strong>
              </div>
            </div>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.analysis-page {
  height: 100%;
  overflow: auto;
  color: rgb(var(--s-on-surface));
}
.analysis-wrap {
  max-width: 1500px;
  margin: 0 auto;
  padding: 28px clamp(18px, 3vw, 44px) 60px;
}
.analysis-header {
  padding: 0 0 24px;
  border-bottom: 1px solid rgb(var(--s-on-surface) / 0.12);
}
.header-copy {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #b8a2c0;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  font-size: 11px;
  font-weight: 800;
}
.analysis-header h1 {
  font-size: clamp(30px, 3vw, 44px);
  letter-spacing: -0.045em;
  line-height: 1.08;
  font-weight: 800;
  margin: 0;
}
.track-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  max-width: 50%;
}
.track-meta img,
.cover-placeholder {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 5px;
  object-fit: cover;
  background: #34405a;
}
.cover-placeholder {
  display: grid;
  place-items: center;
  color: #a0afc8;
}
.track-meta strong,
.track-meta span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-meta strong {
  font-size: 15px;
}
.track-meta span {
  color: #aebbd2;
  font-size: 12px;
  margin-top: 3px;
}
.verdict-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 0;
  border-bottom: 1px solid rgb(var(--s-on-surface) / 0.12);
}
.verdict-card h2 {
  font-size: clamp(24px, 2.5vw, 34px);
  font-weight: 750;
  line-height: 1.2;
  margin-top: 7px;
}
.verdict-card p {
  max-width: 760px;
  color: rgb(var(--s-on-surface-variant));
  font-size: 13px;
  line-height: 1.5;
  margin-top: 6px;
}
.verdict-evidence {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: none;
  color: rgb(var(--s-on-surface-variant));
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.loading-state,
.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  color: rgb(var(--s-on-surface-variant));
}
.loading-state strong {
  color: rgb(var(--s-on-surface));
}
.loading-state small {
  font-size: 12px;
}
.loading-bars {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
.loading-bars span {
  width: 5px;
  height: 20px;
  border-radius: 8px;
  background: #7fd9d7;
  animation: pulse 1.1s ease-in-out infinite alternate;
}
.loading-bars span:nth-child(2n) {
  animation-delay: 0.2s;
}
.loading-bars span:nth-child(3n) {
  animation-delay: 0.4s;
}
@keyframes pulse {
  to {
    height: 40px;
    opacity: 0.4;
  }
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 18px;
}
.metric {
  min-width: 0;
  padding: 18px 0;
  border-bottom: 1px solid rgb(var(--s-on-surface) / 0.12);
}
.metric span,
.metric strong {
  display: block;
}
.metric span {
  color: rgb(var(--s-on-surface-variant));
  font-size: 12px;
}
.metric strong {
  margin-top: 6px;
  font-size: clamp(17px, 2vw, 25px);
  letter-spacing: -0.03em;
  white-space: nowrap;
}
.spectrum-card {
  background: #12121a;
  border: 1px solid #36313e;
  color: #f5f2f7;
  border-radius: 8px;
  padding: clamp(16px, 2vw, 26px);
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.section-heading h2,
.detail-card h2 {
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.03em;
  margin-top: 5px;
}
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #bccbe0;
  font-size: 12px;
}
.zoom-controls button {
  width: 30px;
  height: 30px;
  border: 1px solid #43536b;
  border-radius: 9px;
  background: #202839;
  color: white;
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
}
.zoom-controls button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.zoom-controls button:not(:disabled):hover {
  background: #33445d;
}
.chart-area {
  display: flex;
  gap: 12px;
}
.frequency-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 54px;
  flex: none;
  color: #8c9bb2;
  text-align: right;
  font-size: 10px;
  white-space: nowrap;
}
.canvas-wrap {
  position: relative;
  min-width: 0;
  flex: 1;
}
.canvas-wrap canvas {
  display: block;
  width: 100%;
  height: clamp(340px, 42vh, 540px);
  border-radius: 2px;
  background: #08081a;
}
.crosshair {
  position: absolute;
  pointer-events: none;
  background: #ffffffa8;
  box-shadow: 0 0 3px #160d28;
}
.crosshair-vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}
.crosshair-horizontal {
  left: 0;
  right: 0;
  height: 1px;
}
.cursor-readout {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  background: #091321db;
  color: #fff;
  font-size: 11px;
  pointer-events: none;
}
.time-axis {
  display: flex;
  justify-content: space-between;
  margin: 8px 0 0 66px;
  font-size: 10px;
  color: #8c9bb2;
}
.pan-range {
  display: block;
  width: calc(100% - 66px);
  margin: 14px 0 0 66px;
  accent-color: #79deda;
}
.spectrum-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0 0 66px;
  color: #a9b8cb;
  font-size: 11px;
}
.color-key {
  width: 140px;
  height: 8px;
  border-radius: 8px;
  background: linear-gradient(90deg, #08081a, #220d4c, #631285, #b81c68, #f7412b, #ff931b, #ffdc43);
}
.spectral-note {
  margin-left: auto;
}
.detail-grid {
  margin-top: 18px;
}
.detail-card {
  border-radius: 8px;
  padding: 20px 24px;
  background: rgb(var(--s-surface-panel) / 0.45);
}
.detail-card .eyebrow {
  color: #52a7b7;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #8882;
  padding: 12px 0;
  font-size: 13px;
}
.detail-row span {
  color: rgb(var(--s-on-surface-variant));
}
.detail-row strong {
  text-align: right;
}
@media (max-width: 720px) {
  .header-copy {
    align-items: flex-start;
    flex-direction: column;
  }
  .track-meta {
    max-width: 100%;
  }
  .verdict-card {
    align-items: flex-start;
    flex-direction: column;
  }
  .verdict-evidence {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .canvas-wrap canvas {
    height: 250px;
  }
  .spectral-note {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-bars span {
    animation: none;
  }
}
</style>
