import type { SettingCategory } from "@/types/settings-schema";
import { useSettingsStore } from "@/stores/settings";
import LyricFormatOrderConfig from "@/components/settings/custom/LyricFormatOrderConfig.vue";
import ExcludeLyricsConfig from "@/components/settings/custom/ExcludeLyricsConfig.vue";
import IconLucideMic2 from "~icons/lucide/mic-2";

const lyricCategory: SettingCategory = {
  id: "lyric",
  icon: IconLucideMic2,
  sections: [
    {
      id: "lyricContent",
      items: [
        {
          key: "lyricFormatOrder",
          type: "custom",
          component: LyricFormatOrderConfig,
        },
        {
          key: "detectBackgroundLyrics",
          type: "switch",
          binding: { store: "settings", path: "lyric.detectBackgroundLyrics" },
          defaultValue: true,
        },
        {
          key: "showLyricCredits",
          type: "switch",
          binding: { store: "settings", path: "lyric.showCredits" },
          defaultValue: true,
        },
        {
          key: "cjkTransform",
          type: "select",
          binding: { store: "settings", path: "lyric.cjkTransform" },
          options: [
            { value: "none", labelKey: "settings.cjkTransform.none" },
            { value: "s2t", labelKey: "settings.cjkTransform.s2t" },
            { value: "t2s", labelKey: "settings.cjkTransform.t2s" },
            { value: "s2twp", labelKey: "settings.cjkTransform.s2twp" },
            { value: "tw2sp", labelKey: "settings.cjkTransform.tw2sp" },
            { value: "s2hk", labelKey: "settings.cjkTransform.s2hk" },
            { value: "hk2s", labelKey: "settings.cjkTransform.hk2s" },
            { value: "t2tw", labelKey: "settings.cjkTransform.t2tw" },
            { value: "tw2t", labelKey: "settings.cjkTransform.tw2t" },
            { value: "t2hk", labelKey: "settings.cjkTransform.t2hk" },
            { value: "hk2t", labelKey: "settings.cjkTransform.hk2t" },
            { value: "jp2t", labelKey: "settings.cjkTransform.jp2t" },
            { value: "t2jp", labelKey: "settings.cjkTransform.t2jp" },
          ],
          defaultValue: "none",
        },
      ],
    },
    {
      id: "lyricExclude",
      items: [
        {
          key: "enableExcludeLyrics",
          type: "switch",
          binding: { store: "settings", path: "lyric.enableExcludeLyrics" },
          defaultValue: true,
          children: [
            {
              key: "excludeLyricsRules",
              type: "custom",
              component: ExcludeLyricsConfig,
            },
          ],
        },
      ],
    },
    {
      id: "lyricGeneral",
      items: [
        {
          key: "adaptiveFontSize",
          type: "switch",
          binding: { store: "settings", path: "lyric.adaptiveFontSize" },
          defaultValue: true,
        },
        {
          key: "fontSize",
          type: "slider",
          binding: { store: "settings", path: "lyric.fontSize" },
          min: 12,
          max: 64,
          step: 1,
          defaultValue: 48,
          marks: { 12: "12", 24: "24", 36: "36", 48: "48", 64: "64" },
        },
        {
          key: "translationFontSize",
          type: "slider",
          binding: { store: "settings", path: "lyric.translationFontSize" },
          min: 12,
          max: 64,
          step: 1,
          defaultValue: 22,
          marks: { 12: "12", 24: "24", 36: "36", 48: "48", 64: "64" },
        },
        {
          key: "fontWeight",
          type: "slider",
          binding: { store: "settings", path: "lyric.fontWeight" },
          min: 100,
          max: 900,
          step: 100,
          defaultValue: 700,
          marks: { 100: "100", 400: "400", 700: "700", 900: "900" },
        },
        {
          key: "showTranslation",
          type: "switch",
          binding: { store: "settings", path: "lyric.showTranslation" },
          defaultValue: true,
        },
        {
          key: "showRuby",
          type: "switch",
          binding: { store: "settings", path: "lyric.showRuby" },
          defaultValue: true,
        },
        {
          key: "showRomanization",
          type: "switch",
          binding: { store: "settings", path: "lyric.showRomanization" },
          defaultValue: true,
        },
        {
          key: "showWordRomanization",
          type: "switch",
          binding: { store: "settings", path: "lyric.showWordRomanization" },
          defaultValue: true,
        },
      ],
    },
    {
      id: "lyricDisplay",
      items: [
        {
          key: "enableScale",
          type: "switch",
          binding: { store: "settings", path: "lyric.enableScale" },
          defaultValue: true,
        },
        {
          key: "bgAlwaysBelow",
          type: "switch",
          binding: { store: "settings", path: "lyric.bgAlwaysBelow" },
          defaultValue: false,
        },
        {
          key: "enableBlur",
          type: "switch",
          binding: { store: "settings", path: "lyric.enableBlur" },
          defaultValue: false,
        },
        {
          key: "hidePassedLines",
          type: "switch",
          binding: { store: "settings", path: "lyric.hidePassedLines" },
          defaultValue: false,
        },
      ],
    },
    {
      id: "lyricAMLLOptimize",

      items: [
        {
          key: "amllCleanUnintentionalOverlaps",
          type: "switch",
          binding: { store: "settings", path: "lyric.amllCleanUnintentionalOverlaps" },
          defaultValue: true,
        },
        {
          key: "amllTryAdvanceStartTime",
          type: "switch",
          binding: { store: "settings", path: "lyric.amllTryAdvanceStartTime" },
          defaultValue: true,
        },
        {
          key: "amllSyncMainAndBackgroundLines",
          type: "switch",
          binding: { store: "settings", path: "lyric.amllSyncMainAndBackgroundLines" },
          defaultValue: true,
        },
        {
          key: "amllNormalizeSpaces",
          type: "switch",
          binding: { store: "settings", path: "lyric.amllNormalizeSpaces" },
          defaultValue: true,
        },
        {
          key: "amllResetLineTimestamps",
          type: "switch",
          binding: { store: "settings", path: "lyric.amllResetLineTimestamps" },
          defaultValue: true,
        },
      ],
    },
    {
      id: "lyricSpring",
      items: [
        {
          key: "useAMSpring",
          type: "switch",
          binding: { store: "settings", path: "lyric.useAMSpring" },
          defaultValue: true,

          hideChildren: true,
          childrenCondition: () => useSettingsStore().lyric.useAMSpring,
          children: [
            {
              key: "amllVerticalSpringMass",
              type: "slider",
              binding: { store: "settings", path: "lyric.amllVerticalSpringMass" },
              min: 0.1,
              max: 5,
              step: 0.1,
              defaultValue: 1,
              marks: { 0.1: "0.1", 1: "1", 5: "5" },
            },
            {
              key: "amllVerticalSpringDamping",
              type: "slider",
              binding: { store: "settings", path: "lyric.amllVerticalSpringDamping" },
              min: 0,
              max: 40,
              step: 0.5,
              defaultValue: 15,
              marks: { 0: "0", 15: "15", 40: "40" },
            },
            {
              key: "amllVerticalSpringStiffness",
              type: "slider",
              binding: { store: "settings", path: "lyric.amllVerticalSpringStiffness" },
              min: 1,
              max: 300,
              step: 1,
              defaultValue: 100,
              marks: { 1: "1", 100: "100", 300: "300" },
            },
            {
              key: "amllVerticalSpringSoft",
              type: "switch",
              binding: { store: "settings", path: "lyric.amllVerticalSpringSoft" },
              defaultValue: false,
            },
            {
              key: "amllScaleSpringMass",
              type: "slider",
              binding: { store: "settings", path: "lyric.amllScaleSpringMass" },
              min: 0.1,
              max: 5,
              step: 0.1,
              defaultValue: 1,
              marks: { 0.1: "0.1", 1: "1", 5: "5" },
            },
            {
              key: "amllScaleSpringDamping",
              type: "slider",
              binding: { store: "settings", path: "lyric.amllScaleSpringDamping" },
              min: 0,
              max: 40,
              step: 0.5,
              defaultValue: 20,
              marks: { 0: "0", 20: "20", 40: "40" },
            },
            {
              key: "amllScaleSpringStiffness",
              type: "slider",
              binding: { store: "settings", path: "lyric.amllScaleSpringStiffness" },
              min: 1,
              max: 300,
              step: 1,
              defaultValue: 100,
              marks: { 1: "1", 100: "100", 300: "300" },
            },
            {
              key: "amllScaleSpringSoft",
              type: "switch",
              binding: { store: "settings", path: "lyric.amllScaleSpringSoft" },
              defaultValue: false,
            },
          ],
        },
      ],
    },
    {
      id: "lyricLayout",
      items: [
        {
          key: "alignPosition",
          type: "slider",
          binding: { store: "settings", path: "lyric.alignPosition" },
          min: 0.1,
          max: 0.9,
          step: 0.05,
          defaultValue: 0.35,
          marks: { 0.1: "0.1", 0.35: "0.35", 0.9: "0.9" },
        },
        {
          key: "wordFadeWidth",
          type: "slider",
          binding: { store: "settings", path: "lyric.wordFadeWidth" },
          min: 0.1,
          max: 1,
          step: 0.1,
          defaultValue: 0.5,
          marks: { 0.1: "0.1", 0.5: "0.5", 1: "1" },
        },
      ],
    },
  ],
};

export default lyricCategory;
