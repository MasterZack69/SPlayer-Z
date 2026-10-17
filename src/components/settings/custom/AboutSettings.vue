<script setup lang="ts">
import { useCopyText } from "@/composables/useCopyText";
import { openExternal } from "@/utils/url";
import { APP_VERSION, REPO_URL, REPO_NAME, COMMIT_HASH, COMMIT_DATE } from "@/utils/config";

const props = defineProps<{ highlightKey?: string }>();
const { t } = useI18n();
const { copy } = useCopyText();
const versions = window.electron.process.versions;
const osInfo = window.api.system.osInfo;
const hasCommit = /^[a-f0-9]{7,40}(-dirty)?$/i.test(COMMIT_HASH);
const hasDate = Number.isFinite(Date.parse(COMMIT_DATE));

/** Match settings entry animations, without delaying search navigation.
 * @param index - Section order.
 * @returns Animation timing.
 */
const itemStyle = (index: number) => ({
  animationDelay: props.highlightKey ? "0s" : `${index * 0.03}s`,
  animationFillMode: "backwards" as const,
});

const envItems = computed(() => [
  {
    label: t("settings.about.commit"),
    value: hasCommit ? COMMIT_HASH : t("settings.about.sourceArchive"),
    url: hasCommit ? `${REPO_URL}/commit/${COMMIT_HASH.replace(/-dirty$/, "")}` : undefined,
  },
  {
    label: t("settings.about.date"),
    value: hasDate ? new Date(COMMIT_DATE).toISOString() : t("settings.about.notProvided"),
  },
  { label: "Electron", value: versions.electron },
  { label: "Chromium", value: versions.chrome },
  { label: "Node.js", value: versions.node },
  { label: "V8", value: versions.v8 },
  { label: "OS", value: `${osInfo.type} ${osInfo.arch} ${osInfo.release}` },
]);

/** Open the local application log directory. */
const handleOpenLogs = (): void => void window.api.system.openLogsDir();

/** Copy the displayed environment details for bug reports. */
const handleCopyEnvInfo = (): void => {
  copy(envItems.value.map((item) => `${item.label}: ${item.value}`).join("\n"));
};
</script>

<template>
  <div class="flex flex-col gap-8">
    <section>
      <h3 class="flex items-center gap-2 text-lg font-semibold text-on-surface mb-3 px-1">
        <span class="w-0.75 h-4 rounded-full bg-primary" />
        {{ t("settings.section.aboutApp") }}
      </h3>
      <SCard
        variant="settings"
        :bordered="false"
        radius="xl"
        class="animate-slide-in-item flex flex-wrap items-center gap-4"
        :style="itemStyle(0)"
      >
        <SLogo :size="34" />
        <div class="flex flex-wrap items-center gap-2 mr-auto min-w-0">
          <span class="text-lg font-semibold text-on-surface">{{ REPO_NAME }}</span>
          <STag type="primary" size="small" round>V{{ APP_VERSION }}</STag>
        </div>
        <SButton variant="secondary" @click="handleOpenLogs">
          {{ t("settings.about.openLogs") }}
        </SButton>
      </SCard>
    </section>

    <section>
      <h3 class="flex items-center gap-2 text-lg font-semibold text-on-surface mb-3 px-1">
        <span class="w-0.75 h-4 rounded-full bg-primary" />
        {{ t("settings.section.developers") }}
      </h3>
      <SCard
        variant="settings"
        :bordered="false"
        radius="xl"
        class="animate-slide-in-item flex flex-col items-center text-center gap-3 py-6"
        :style="itemStyle(1)"
      >
        <SImg
          src="https://github.com/MasterZack69.png?size=128"
          fallback="./images/avatar.jpg"
          class="size-16 rounded-full"
        />
        <a
          href="https://github.com/MasterZack69"
          target="_blank"
          rel="noopener noreferrer"
          class="font-semibold text-on-surface hover:text-primary"
        >
          MasterZack69
        </a>
        <span class="text-sm text-on-surface-variant">{{ t("settings.about.maintainer") }}</span>
        <p class="text-sm text-on-surface-variant mt-2 max-w-lg">
          {{ t("settings.about.upstreamThanks") }}
        </p>
      </SCard>
    </section>

    <section>
      <div class="flex items-center justify-between mb-3 px-1">
        <h3 class="flex items-center gap-2 text-lg font-semibold text-on-surface">
          <span class="w-0.75 h-4 rounded-full bg-primary" />
          {{ t("settings.section.envInfo") }}
        </h3>
        <SButton variant="ghost" circle size="small" @click="handleCopyEnvInfo">
          <template #icon><IconLucideCopy /></template>
        </SButton>
      </div>
      <SCard
        variant="settings"
        :bordered="false"
        radius="xl"
        class="animate-slide-in-item break-all select-text space-y-1.5"
        :style="itemStyle(2)"
      >
        <div
          v-for="item in envItems"
          :key="item.label"
          class="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2"
        >
          <span class="text-on-surface/60 shrink-0">{{ item.label }}:</span>
          <a
            v-if="item.url"
            :href="item.url"
            class="text-on-surface hover:text-primary cursor-pointer flex items-center gap-1 w-fit"
            @click.prevent="openExternal(item.url!)"
          >
            {{ item.value }}
            <IconLucideArrowUpRight class="size-3 shrink-0" />
          </a>
          <span v-else class="text-on-surface break-words">{{ item.value }}</span>
        </div>
      </SCard>
    </section>
  </div>
</template>
