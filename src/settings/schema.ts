import type { SettingCategory } from "@/types/settings-schema";
import generalCategory from "./categories/general";
import appearanceCategory from "./categories/appearance";
import playerCategory from "./categories/player";
import lyricCategory from "./categories/lyric";
import hotkeysCategory from "./categories/hotkeys";
import servicesCategory from "./categories/services";
import mediaSourceCategory from "./categories/streaming";
import localCacheCategory from "./categories/localCache";
import otherCategory from "./categories/other";
import { updateSection } from "./sections/update";
import AboutSettings from "@/components/settings/custom/AboutSettings.vue";
import IconLucideInfo from "~icons/lucide/info";

export const settingsSchema: SettingCategory[] = [
  generalCategory,
  appearanceCategory,
  playerCategory,
  lyricCategory,
  hotkeysCategory,
  servicesCategory,
  mediaSourceCategory,
  localCacheCategory,
  otherCategory,
  { id: "about", icon: IconLucideInfo, component: AboutSettings, sections: [updateSection] },
];
