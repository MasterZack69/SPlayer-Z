<script setup lang="ts">
import type { SImgProps } from "@/components/ui/SImg.vue";
import defaultFallback from "@/assets/images/song.jpg";

const props = withDefaults(defineProps<SImgProps>(), {
  fallback: defaultFallback,
  alt: "",
});

const loaded = ref(false);
const imageRef = shallowRef<HTMLImageElement>();
/** Keep the built-in placeholder available if the thumbnail also fails. */
const fallbackSrc = ref(props.fallback || defaultFallback);

watch(
  () => props.fallback,
  (value) => {
    fallbackSrc.value = value || defaultFallback;
  },
);

watch(
  () => props.src,
  () => {
    loaded.value = false;
  },
);

/**
 * Reveal decoded artwork only if it still belongs to the current source.
 * @param event - Native image load event.
 */
const handleLoad = async (event: Event): Promise<void> => {
  const image = event.target as HTMLImageElement;
  try {
    await image.decode();
  } catch {
    return;
  }
  if (imageRef.value === image && image.getAttribute("src") === props.src) loaded.value = true;
};

/** Replace a failed thumbnail with the built-in placeholder. */
const handleFallbackError = (): void => {
  if (fallbackSrc.value !== defaultFallback) fallbackSrc.value = defaultFallback;
};
</script>

<template>
  <div class="relative isolate overflow-hidden">
    <img
      v-if="!loaded"
      :src="fallbackSrc"
      :alt="alt"
      class="absolute inset-0 size-full object-cover"
      decoding="async"
      @error="handleFallbackError"
    />
    <img
      v-if="src"
      ref="imageRef"
      :key="src"
      :src="src"
      :alt="alt"
      data-cover-image
      class="absolute inset-0 size-full object-cover"
      :style="{ opacity: loaded ? 1 : 0 }"
      loading="eager"
      decoding="async"
      @load="handleLoad"
      @error="loaded = false"
    />
  </div>
</template>
