import type { SettingCategory } from "@/types/settings-schema";
import LastfmPanel from "@/components/settings/custom/LastfmPanel.vue";
import IconLucideGlobe from "~icons/lucide/globe";

const servicesCategory: SettingCategory = {
  id: "services",
  icon: IconLucideGlobe,
  sections: [
    {
      id: "media",
      items: [
        {
          key: "systemMediaControls",
          type: "switch",
          binding: { store: "settings", path: "system.media.systemMediaControls" },
          defaultValue: true,
        },
      ],
    },
    {
      id: "lastfm",
      items: [
        {
          key: "lastfmEnabled",
          type: "switch",
          binding: { store: "settings", path: "system.lastfm.enabled" },
          defaultValue: false,
          children: [
            {
              key: "lastfmAccount",
              type: "custom",
              component: LastfmPanel,
              fullWidth: true,
              keywords: ["settings.lastfm.connect", "settings.lastfm.disconnect"],
            },
            {
              key: "lastfmScrobble",
              type: "switch",
              binding: { store: "settings", path: "system.lastfm.scrobble" },
              defaultValue: true,
            },
            {
              key: "lastfmNowPlaying",
              type: "switch",
              binding: { store: "settings", path: "system.lastfm.nowPlaying" },
              defaultValue: true,
            },
            {
              key: "lastfmLoveSync",
              type: "switch",
              binding: { store: "settings", path: "system.lastfm.loveSync" },
              defaultValue: true,
            },
          ],
        },
      ],
    },
  ],
};

export default servicesCategory;
