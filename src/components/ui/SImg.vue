<script setup lang="ts">
import defaultFallback from "@/assets/images/song.jpg";

export interface SImgProps {
  /** 图片地址 */
  src?: string;
  /** 占位图地址 */
  fallback?: string;
  /** alt 文字 */
  alt?: string;
  /** Animate newly loaded images; disable for recycled virtual-list thumbnails. */
  fade?: boolean;
  /** Use eager loading when virtualization already bounds the rendered images. */
  loading?: "lazy" | "eager";
}

const props = withDefaults(defineProps<SImgProps>(), {
  fallback: defaultFallback,
  alt: "",
  fade: true,
  loading: "lazy",
});

const emit = defineEmits<{
  load: [el: HTMLImageElement];
}>();

const isLoaded = ref(false);

/**
 * Reveal a loaded cover and notify its consumer.
 * @param e - Native load event from the cover image.
 */
const onLoad = (e: Event): void => {
  const target = e.target as HTMLImageElement;
  target.style.opacity = "1";
  isLoaded.value = true;
  emit("load", target);
};

watch(
  () => props.src,
  () => {
    isLoaded.value = false;
  },
);
</script>

<template>
  <div class="relative isolate overflow-hidden">
    <!-- Keep a placeholder beneath covers until loading completes. -->
    <Transition name="fade" :css="fade">
      <img
        v-if="!isLoaded"
        :src="fallback"
        :alt="alt"
        class="absolute w-full h-full object-cover z-0"
      />
    </Transition>
    <!-- Virtualized thumbnails skip the entrance fade to avoid flashes on remount. -->
    <Transition
      :css="fade"
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="src" :key="src" class="absolute inset-0 z-1">
        <img
          :src="src"
          :alt="alt"
          class="w-full h-full object-cover"
          :class="fade ? 'opacity-0 transition-opacity duration-200' : ''"
          decoding="async"
          :loading="loading"
          @load="onLoad"
          @error="isLoaded = false"
        />
      </div>
    </Transition>
  </div>
</template>
