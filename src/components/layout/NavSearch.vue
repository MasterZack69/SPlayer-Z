<script setup lang="ts">
import { PAGE_SEARCH_SCOPES } from "@/utils/search/match";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const keyword = ref("");
const scope = computed(() => PAGE_SEARCH_SCOPES[String(route.name)]);
const placeholder = computed(() =>
  scope.value ? t(`search.scope.${scope.value}`) : t("nav.searchPlaceholder"),
);

watch(
  () => route.fullPath,
  () => {
    const value = scope.value ? route.query.filter : route.name === "search" ? route.query.q : "";
    keyword.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);

/**
 * Update page filters immediately and clear global results when the input is cleared.
 * @param value - Current input text, including an empty value from the clear button.
 */
const updateKeyword = (value: string): void => {
  keyword.value = value;
  if (scope.value) {
    void router.replace({ query: { ...route.query, filter: value || undefined } });
  } else if (route.name === "search" && !value.trim()) {
    void router.replace({ name: "search", query: {} });
  }
};

/**
 * Submit global search or apply the current page's filter, including paste-and-search text.
 * @param value - Submitted text; defaults to the current input.
 */
const search = (value = keyword.value): void => {
  keyword.value = value;
  if (scope.value) updateKeyword(value);
  else void router.push({ name: "search", query: value.trim() ? { q: value.trim() } : {} });
};
</script>

<template>
  <form class="app-no-drag min-w-0 w-60" role="search" @submit.prevent="search()">
    <NavSearchInput
      :model-value="keyword"
      :placeholder="placeholder"
      @update:model-value="updateKeyword"
      @search="search"
    />
  </form>
</template>
