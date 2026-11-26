import type { SettingCategory } from "@/types/settings-schema";
import SkipKeywordsConfig from "@/components/settings/custom/SkipKeywordsConfig.vue";
import IconLucideSettings from "~icons/lucide/settings";

const otherCategory: SettingCategory = {
  id: "other",
  icon: IconLucideSettings,
  sections: [
    {
      id: "preset",
      items: [
        {
          key: "skipKeywordsSongs",
          type: "custom",
          component: SkipKeywordsConfig,
        },
        {
          key: "ignoreMusicGenre",
          type: "switch",
          binding: { store: "settings", path: "preset.ignoreMusicGenre" },
          defaultValue: true,
        },
        {
          key: "hideHomeStats",
          type: "switch",
          binding: { store: "settings", path: "preset.hideHomeStats" },
          defaultValue: false,
        },
        {
          key: "hideQualityTag",
          type: "switch",
          binding: { store: "settings", path: "preset.hideQualityTag" },
          defaultValue: false,
        },
        {
          key: "hideExplicitTag",
          type: "switch",
          binding: { store: "settings", path: "preset.hideExplicitTag" },
          defaultValue: false,
        },
        {
          key: "showSubtitle",
          type: "switch",
          binding: { store: "settings", path: "preset.showSubtitle" },
          defaultValue: true,
        },
      ],
    },
  ],
};

export default otherCategory;
