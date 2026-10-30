<script setup lang="ts">
import { useMediaStore } from "@/stores/media";
import { useSettingsStore } from "@/stores/settings";
import { openExternal } from "@/utils/url";

const media = useMediaStore();
const settings = useSettingsStore();
</script>

<template>
  <div
    v-if="
      settings.lyric.showCredits && (media.lyricAuthors.length || media.lyricSongwriters.length)
    "
    class="w-full flex flex-col gap-1 text-left text-[max(0.5em,10px)]"
  >
    <div v-if="media.lyricAuthors.length" class="flex flex-wrap items-center">
      <span class="text-cover/40 select-none">{{ $t("player.lyricCredit") }}</span>
      <template v-for="(author, idx) in media.lyricAuthors" :key="author">
        <span v-if="idx > 0" class="mx-0.5 text-cover/30">,</span>
        <a
          :href="`https://github.com/${author}`"
          class="ml-1 px-1.5 py-0.5 rounded-md text-cover/50 transition-all duration-200 hover:text-cover hover:bg-cover/14 active:scale-95"
          @click.stop.prevent="openExternal(`https://github.com/${author}`)"
        >
          {{ "@" + author }}
        </a>
      </template>
    </div>
    <div v-if="media.lyricSongwriters.length" class="flex flex-wrap items-center">
      <span class="text-cover/40 select-none">{{ $t("player.songwriterCredit") }}</span>
      <template v-for="(writer, idx) in media.lyricSongwriters" :key="writer">
        <span v-if="idx > 0" class="mx-0.5 text-cover/30">,</span>
        <span class="ml-1 px-1.5 py-0.5 text-cover/50">{{ writer }}</span>
      </template>
    </div>
  </div>
</template>
