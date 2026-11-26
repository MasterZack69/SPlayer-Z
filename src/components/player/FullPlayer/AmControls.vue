<script setup lang="ts">
import { useStatusStore } from "@/stores/status";
import { useMediaStore } from "@/stores/media";
import { useSettingsStore } from "@/stores/settings";
import { useFavorite } from "@/composables/useFavorite";
import { useTimeFormat } from "@/composables/useTimeFormat";
import { useProgressLyric } from "@/composables/useProgressLyric";
import { getValidArtists } from "@shared/utils/track";
import { getQualityLabel, isLosslessQuality } from "@/utils/quality";
import { volumeGainToPosition, volumePositionToGain } from "@/utils/volume";
import * as player from "@/core/player";
import type { Artist } from "@shared/types/player";
import {
  canNavigateToResource,
  navigateToResource,
  type ResourceNavigationTarget,
} from "@/utils/navigate";
import { setPlayerExpanded } from "@/services/playerTransition";

const emit = defineEmits<{ addToPlaylist: [] }>();
const { t } = useI18n();
const status = useStatusStore();
const media = useMediaStore();
const settings = useSettingsStore();
const fav = useFavorite();
const { timeDisplay, toggleTimeFormat } = useTimeFormat();
const { snapToNearestLyric } = useProgressLyric();
const track = computed(() => media.track ?? status.currentTrack);
const artists = computed(() => getValidArtists(track.value?.artists));

/**
 * Build the same source-aware artist destination used by track details.
 * @param artist - Artist from the displayed track.
 * @returns A destination including its source and server identity.
 */
const artistTarget = (artist: Artist): ResourceNavigationTarget => ({
  type: "artist",
  source: track.value?.source,
  serverId: track.value?.serverId,
  id: artist.id,
  name: artist.name,
});

/**
 * Open the artist and collapse the player only when navigation succeeds.
 * @param artist - Artist from the displayed track.
 */
const openArtist = (artist: Artist): void => {
  if (navigateToResource(artistTarget(artist))) setPlayerExpanded(false);
};
const quality = computed(() => media.detail?.quality ?? track.value?.quality);
const volume = computed(() => volumeGainToPosition(status.volume));

/** Seek to the selected time, respecting lyric snapping.
 * @param value - Requested playback position in milliseconds.
 */
const seek = (value: number): void => {
  void player.seek(snapToNearestLyric(value));
};
/** Set the volume using the shared perceptual curve.
 * @param value - Slider position from zero to one.
 */
const setVolume = (value: number): void => {
  void player.setVolume(volumePositionToGain(value));
};
</script>

<template>
  <div class="am-controls w-full flex flex-col gap-[clamp(0.35rem,1.6vh,1rem)] text-cover">
    <div class="flex items-center gap-2 min-w-0">
      <div class="flex-1 min-w-0">
        <SPopover trigger="click" side="top" align="start" block cover>
          <template #trigger>
            <button
              type="button"
              class="flex-1 min-w-0 text-left text-cover bg-transparent border-none p-0 cursor-pointer rounded focus-visible:outline focus-visible:outline-2"
              :aria-label="t('player.am.trackDetails')"
            >
              <SMarquee fit class="max-w-full font-semibold text-[clamp(14px,2vh,22px)]">
                {{ track?.title }}
                <IconSpExplicit
                  v-if="track?.explicit && !settings.preset.hideExplicitTag"
                  :aria-label="t('songList.explicitTagLabel')"
                  class="inline-block align-[-0.12em] ml-1 size-[0.85em] text-cover/70"
                />
              </SMarquee>
            </button>
          </template>
          <div class="w-[min(80vw,320px)]"><PlayerData align="left" /></div>
        </SPopover>
        <div class="truncate text-cover/50 text-[clamp(12px,1.7vh,17px)]">
          <template v-if="artists.length">
            <template v-for="(artist, index) in artists" :key="`${artist.id}-${index}`">
              <span v-if="index">{{ ", " }}</span>
              <button
                v-if="canNavigateToResource(artistTarget(artist))"
                type="button"
                class="border-none bg-transparent p-0 text-inherit cursor-pointer hover:underline focus-visible:outline focus-visible:outline-2"
                @click="openArtist(artist)"
              >
                {{ artist.name }}
              </button>
              <span v-else>{{ artist.name }}</span>
            </template>
          </template>
          <span v-else>{{ t("playlist.unknownArtist") }}</span>
        </div>
      </div>
      <SButton
        type="cover"
        variant="secondary"
        circle
        :size="32"
        :disabled="!track || !fav.isSupported(track)"
        :aria-label="t('player.am.favorite')"
        :aria-pressed="fav.isLiked(track)"
        @click="fav.toggle(track)"
      >
        <template #icon>
          <IconSpAmStarFilled v-if="fav.isLiked(track)" />
          <IconSpAmStar v-else />
        </template>
      </SButton>
      <SButton
        v-if="track?.source === 'local' || track?.source === 'netease'"
        type="cover"
        variant="secondary"
        circle
        :size="32"
        :aria-label="t('player.am.addToPlaylist')"
        @click="emit('addToPlaylist')"
      >
        <template #icon><IconLucideListPlus /></template>
      </SButton>
    </div>
    <div>
      <SSlider
        :model-value="status.position"
        :glow="status.transitioning && status.isPlayerExpanded"
        :min="0"
        :max="status.duration"
        :step="100"
        :track-height="8"
        :hover-track-height="20"
        :thumb-size="20"
        :disabled="!track || status.duration <= 0"
        :label="t('player.am.seek')"
        hide-thumb
        cover
        @drag-end="seek"
      />
      <div
        class="mt-1 min-h-[1.5em] grid grid-cols-[1fr_auto_1fr] items-center text-xs tabular-nums text-cover/55"
      >
        <button
          type="button"
          class="border-none bg-transparent p-0 text-inherit text-left cursor-pointer"
          :aria-label="t('player.am.timeFormat')"
          @click="toggleTimeFormat"
        >
          {{ timeDisplay[0] }}
        </button>
        <button
          v-if="quality || status.transitioning"
          type="button"
          class="border-none rounded bg-cover/15 px-1.5 py-0.5 text-cover/80 cursor-pointer"
          :disabled="status.transitioning"
          @click="status.audioInfoOpen = true"
        >
          <template v-if="status.transitioning">{{ t("player.transitioning") }}</template>
          <template v-else>
            <IconSpLossless v-if="quality && isLosslessQuality(quality)" />
            {{ quality && getQualityLabel(quality) }}
          </template>
        </button>
        <span v-else />
        <button
          type="button"
          class="border-none bg-transparent p-0 text-inherit text-right cursor-pointer"
          :aria-label="t('player.am.timeFormat')"
          @click="toggleTimeFormat"
        >
          {{ timeDisplay[1] }}
        </button>
      </div>
    </div>
    <div class="flex items-center justify-between">
      <SButton
        type="cover"
        variant="ghost"
        circle
        size="auto"
        class="w-[18%] aspect-square"
        :aria-label="t('settings.hotkeys.actions.toggleShuffle')"
        @click="
          status.fmMode
            ? player.dislikeFmTrack()
            : status.heartMode
              ? player.exitHeartMode()
              : player.toggleShuffleMode()
        "
      >
        <IconLucideHeartOff v-if="status.fmMode" class="size-[clamp(20px,3vh,30px)]" />
        <IconSpHeartMode v-else-if="status.heartMode" class="size-[clamp(20px,3vh,30px)]" />
        <IconSpAmShuffleActive
          v-else-if="status.shuffleMode === 'on'"
          class="size-[clamp(24px,4vh,48px)]"
        />
        <IconSpAmShuffle v-else class="size-[clamp(24px,4vh,48px)]" />
      </SButton>
      <SButton
        type="cover"
        variant="ghost"
        circle
        size="auto"
        class="w-[18%] aspect-square"
        :disabled="!track || status.fmMode"
        :aria-label="t('player.prev')"
        @click="player.prevTrack()"
      >
        <IconSpAmRewind class="size-[clamp(30px,6vh,70px)]" />
      </SButton>
      <SButton
        type="cover"
        variant="ghost"
        circle
        size="auto"
        class="w-[18%] aspect-square"
        :disabled="!track && !status.isLoading"
        :aria-label="t('settings.hotkeys.actions.togglePlay')"
        @click="player.togglePlay()"
      >
        <SLoading v-if="status.isLoading" class="size-[clamp(25px,4vh,48px)]" />
        <IconSpAmPause v-else-if="status.isPlaying" class="size-[clamp(25px,4vh,48px)]" />
        <IconSpAmPlay v-else class="size-[clamp(25px,4vh,48px)]" />
      </SButton>
      <SButton
        type="cover"
        variant="ghost"
        circle
        size="auto"
        class="w-[18%] aspect-square"
        :disabled="!track"
        :aria-label="t('player.next')"
        @click="player.nextTrack()"
      >
        <IconSpAmForward class="size-[clamp(30px,6vh,70px)]" />
      </SButton>
      <SButton
        type="cover"
        variant="ghost"
        circle
        size="auto"
        class="w-[18%] aspect-square"
        :disabled="status.fmMode"
        :aria-label="t('settings.hotkeys.actions.cycleRepeat')"
        @click="player.cycleRepeatMode()"
      >
        <IconLucideInfinity v-if="status.fmMode" class="size-6" />
        <IconSpAmRepeatOne
          v-else-if="status.repeatMode === 'one'"
          class="size-[clamp(24px,4vh,48px)]"
        />
        <IconSpAmRepeatActive v-else class="size-[clamp(24px,4vh,48px)]" />
      </SButton>
    </div>
    <div class="flex items-center gap-2 text-cover/50">
      <IconSpAmSpeaker class="shrink-0 w-6 h-7" />
      <SSlider
        :model-value="volume"
        :min="0"
        :max="1"
        :step="0.01"
        :track-height="8"
        :hover-track-height="20"
        :thumb-size="20"
        :label="t('player.am.volume')"
        hide-thumb
        cover
        class="flex-1"
        @change="setVolume"
      />
      <IconSpAmSpeakerMax class="shrink-0 w-8 h-7" />
    </div>
  </div>
</template>
