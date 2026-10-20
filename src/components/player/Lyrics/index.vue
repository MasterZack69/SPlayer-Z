<script setup lang="ts">
import type { LyricLine } from "@shared/types/lyrics";
import { useSettingsStore } from "@/stores/settings";
import AMLLLyrics from "./AMLLLyrics.vue";
import LyricCredit from "./LyricCredit.vue";

const props = withDefaults(
  defineProps<{
    /** Timed lyric lines. */
    lyricLines: LyricLine[];
    /** Initial playback position in milliseconds. */
    initialTime?: number;
    /** Whether playback is running. */
    playing?: boolean;
  }>(),
  {
    initialTime: 0,
    playing: false,
  },
);

const emit = defineEmits<{
  (e: "seek", timeMs: number): void;
  (e: "ready"): void;
}>();

const settings = useSettingsStore();

type LyricPlayerInstance = {
  setCurrentTime: (time: number, isSeeking?: boolean) => void;
  freeze: () => void;
  resume: () => void;
};

const lyricPlayerRef = ref<LyricPlayerInstance | null>(null);

/**
 * Synchronize AMLL with playback.
 * @param time - Playback position in milliseconds.
 * @param isSeeking - Whether this update is an explicit seek.
 */
const setCurrentTime = (time: number, isSeeking = false) => {
  lyricPlayerRef.value?.setCurrentTime(time, isSeeking);
};

/** Suspend lyric rendering while the player is hidden. */
const freeze = () => {
  lyricPlayerRef.value?.freeze();
};

/** Resume lyric rendering with the latest buffered lines. */
const resume = () => {
  lyricPlayerRef.value?.resume();
};

defineExpose({
  setCurrentTime,
  freeze,
  resume,
});
</script>

<template>
  <AMLLLyrics
    ref="lyricPlayerRef"
    :lyric-lines="props.lyricLines"
    :initial-time="props.initialTime"
    :playing="props.playing"
    :align-position="settings.lyric.alignPosition"
    :word-fade-width="settings.lyric.wordFadeWidth"
    :hide-passed-lines="settings.lyric.hidePassedLines"
    :enable-blur="settings.lyric.enableBlur"
    :show-translation="settings.lyric.showTranslation"
    :show-ruby="settings.lyric.showRuby"
    :show-romanization="settings.lyric.showRomanization"
    :show-word-romanization="settings.lyric.showWordRomanization"
    :bg-always-below="settings.lyric.bgAlwaysBelow"
    @seek="emit('seek', $event)"
    @ready="emit('ready')"
  >
    <template #bottom>
      <slot name="bottom">
        <LyricCredit />
      </slot>
    </template>
  </AMLLLyrics>
</template>
