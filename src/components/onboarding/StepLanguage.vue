<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import { LOCALES } from "@shared/types/settings";

const { t } = useI18n();
const settings = useSettingsStore();
defineEmits<{ (e: "next"): void }>();
</script>

<template>
  <div class="flex flex-col w-full max-w-2xl mx-auto my-auto">
    <div class="flex items-center gap-3 mb-2">
      <IconLucideLanguages class="size-6 text-primary" />
      <h1 class="text-2xl font-bold">{{ t("onboarding.language.title") }}</h1>
    </div>
    <p class="text-on-surface-variant/70 mb-6 leading-relaxed">
      {{ t("onboarding.language.subtitle") }}
    </p>
    <div
      class="flex items-center justify-between gap-4 rounded-xl bg-on-surface/4 border border-solid border-primary/10 px-4 py-3 mb-6"
    >
      <span class="text-sm">{{ t("onboarding.preferences.languageLabel") }}</span>
      <div class="shrink-0 w-40">
        <SSelect
          :model-value="settings.locale"
          :options="LOCALES"
          @update:model-value="settings.locale = $event as typeof settings.locale"
        />
      </div>
    </div>
    <div class="flex justify-end">
      <SButton type="primary" round @click="$emit('next')">
        {{ t("onboarding.next") }}
        <template #icon><IconLucideArrowRight /></template>
      </SButton>
    </div>
  </div>
</template>
