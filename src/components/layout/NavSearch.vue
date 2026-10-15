<script setup lang="ts">
const { t } = useI18n();
const router = useRouter();
const keyword = ref("");
/** 搜索本地曲库及已同步的媒体服务器索引 */
const search = (): void => {
  const q = keyword.value.trim();
  if (q) void router.push({ path: "/search", query: { q } });
};
</script>

<template>
  <form class="app-no-drag min-w-0 w-60" @submit.prevent="search">
    <NavSearchInput v-model="keyword" :placeholder="t('nav.searchPlaceholder')" @search="search" />
  </form>
</template>
