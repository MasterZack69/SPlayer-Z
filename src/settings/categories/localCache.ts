import type { SettingCategory } from "@/types/settings-schema";
import FileCacheManager from "@/components/settings/custom/FileCacheManager.vue";
import IconLucideHardDrive from "~icons/lucide/hard-drive";

const localCacheCategory: SettingCategory = {
  id: "localCache",
  icon: IconLucideHardDrive,
  sections: [
    {
      id: "cache",
      items: [
        {
          key: "fileCacheManager",
          type: "custom",
          component: FileCacheManager,
          fullWidth: true,
          keywords: ["settings.cacheDir.label", "settings.fileClearAll.label"],
        },
      ],
    },
  ],
};

export default localCacheCategory;
