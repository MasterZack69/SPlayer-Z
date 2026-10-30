import {
  SONG_LIST_COLUMNS,
  normalizeSongListColumnOrder,
  normalizeSongListHiddenColumns,
} from "@/utils/songListColumns";
import type {
  PlayerSettings,
  LyricSettings,
  AppearanceSettings,
  SidebarNavGroup,
  SidebarPlaylistOrder,
  PresetSettings,
} from "@/types/settings";
import {
  DEFAULT_LYRIC_FORMAT_ORDER,
  DEFAULT_LYRIC_SOURCE_ORDER,
  DEFAULT_SIDEBAR_NAV_GROUPS,
  SIDEBAR_NAV_PLACEMENT_FIXES,
  SIDEBAR_GROUP_MY_PLAYLISTS,
  SIDEBAR_GROUP_SUBSCRIBED,
} from "@/types/settings";
import type { SystemConfig, LocaleCode } from "@shared/types/settings";
import { ALL_PLATFORMS } from "@shared/types/platform";
import { defaultSystemConfig } from "@shared/defaults/settings";
import { setByPath } from "@shared/utils/path";
import { DEFAULT_SKIP_TRACK_KEYWORDS } from "@/utils/preset/skipKeywords";

/**
 * 对账有序集合：保留存档中仍有效的项（顺序不变），
 * 末尾补上完整集合里缺失的新项，剔除已失效的项
 * 用于平台/格式偏好——新增平台或格式时无需用户手动重置即可生效
 * @param stored - 存档顺序
 * @param all - 当前完整集合
 * @returns 对账后的顺序
 */
const reconcileOrder = <T>(stored: T[], all: readonly T[]): T[] => {
  const known = stored.filter((item) => all.includes(item));
  const missing = all.filter((item) => !known.includes(item));
  return [...known, ...missing];
};

/**
 * 对账侧边栏导航分组：仅保留已知导航项并去重（空组保留），
 * 新增的导航项补到末组，存档无效时回退默认分组
 * @param stored - 存档分组
 * @returns 对账后的分组
 */
const reconcileNavGroups = (stored: unknown): SidebarNavGroup[] => {
  const all = DEFAULT_SIDEBAR_NAV_GROUPS.flatMap((group) => group.keys);
  const seen = new Set<string>();
  const groups: SidebarNavGroup[] = [];
  for (const raw of Array.isArray(stored) ? stored : []) {
    const record = raw as Partial<SidebarNavGroup> | null;
    if (!Array.isArray(record?.keys)) continue;
    const keys: string[] = [];
    for (const key of record.keys) {
      if (!all.includes(key) || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    groups.push({
      name: typeof record.name === "string" ? record.name : "",
      showName: record.showName === true,
      keys,
    });
  }
  if (groups.length === 0)
    return DEFAULT_SIDEBAR_NAV_GROUPS.map((group) => ({ ...group, keys: [...group.keys] }));
  // 新增项按默认布局插到相邻项后面（如「流派」跟在「专辑」之后），找不到锚点才追加到末组
  for (const key of all.filter((item) => !seen.has(item))) {
    placeNavKeyByDefaults(groups, key);
  }
  return groups;
};

/**
 * 把导航项移动到默认布局中的相邻位置（锚定前一个默认项）
 * @param groups - 分组列表（就地修改）
 * @param key - 待放置的导航项
 */
const placeNavKeyByDefaults = (groups: SidebarNavGroup[], key: string): void => {
  const all = DEFAULT_SIDEBAR_NAV_GROUPS.flatMap((group) => group.keys);
  for (let index = all.indexOf(key) - 1; index >= 0; index--) {
    const anchor = all[index];
    for (const group of groups) {
      const position = group.keys.indexOf(anchor);
      if (position < 0) continue;
      group.keys.splice(position + 1, 0, key);
      return;
    }
  }
  groups[groups.length - 1].keys.push(key);
};

/**
 * 对新增导航项做一次性位置校正：
 * 老存档会把新增项追加到末组，这里按默认布局移回相邻位置，之后不再改动
 * @param groups - 分组列表（就地修改）
 * @param placed - 已执行过的校正记录 id 存档
 * @returns 更新后的校正记录 id 列表
 */
const applyNavPlacementFixes = (groups: SidebarNavGroup[], placed: unknown): string[] => {
  const done = new Set(
    (Array.isArray(placed) ? placed : []).filter((key): key is string => typeof key === "string"),
  );
  for (const fix of SIDEBAR_NAV_PLACEMENT_FIXES) {
    if (done.has(fix.id)) continue;
    for (const group of groups) {
      const position = group.keys.indexOf(fix.key);
      if (position >= 0) group.keys.splice(position, 1);
    }
    placeNavKeyByDefaults(groups, fix.key);
    done.add(fix.id);
  }
  // 只保留当前仍在维护的校正记录，顺带清掉早期版本写入的无效标记
  const known = new Set(SIDEBAR_NAV_PLACEMENT_FIXES.map((fix) => fix.id));
  return [...done].filter((id) => known.has(id));
};

/**
 * 对账侧边栏隐藏键：仅保留有效的导航项、歌单分组与歌单路由键，首页不可隐藏
 * @param stored - 存档隐藏键
 * @returns 对账后的隐藏键
 */
const reconcileHiddenKeys = (stored: string[]): string[] => {
  const valid = new Set([
    ...DEFAULT_SIDEBAR_NAV_GROUPS.flatMap((group) => group.keys),
    SIDEBAR_GROUP_MY_PLAYLISTS,
    SIDEBAR_GROUP_SUBSCRIBED,
  ]);
  return stored.filter((key) => key !== "/" && (valid.has(key) || key.startsWith("/collection/")));
};

/**
 * 对账侧边栏歌单顺序：剔除非法存档，保证各字段均为字符串数组
 * @param stored - 存档顺序
 * @returns 对账后的顺序
 */
const reconcilePlaylistOrder = (stored: unknown): SidebarPlaylistOrder => {
  const record = (stored ?? {}) as Partial<Record<keyof SidebarPlaylistOrder, unknown>>;
  const orderOf = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((key) => typeof key === "string") : [];
  return {
    myLocal: orderOf(record.myLocal),
    myOnline: orderOf(record.myOnline),
    subscribed: orderOf(record.subscribed),
  };
};

export const useSettingsStore = defineStore(
  "settings",
  () => {
    /** 界面语言 */
    const locale = ref<LocaleCode>("en-US");

    /** 外观 */
    const appearance = reactive<AppearanceSettings>({
      layoutMode: "default",
      songListStyle: "comfortable",
      songListColumnOrder: [...SONG_LIST_COLUMNS],
      songListHiddenColumns: [],
      routeTransition: "fade",
      seamlessTransition: false,
      reduceMotion: false,
      sidebarCollapsed: false,
      sidebarPlaylistCover: false,
      sidebarNavGroups: DEFAULT_SIDEBAR_NAV_GROUPS.map((group) => ({
        ...group,
        keys: [...group.keys],
      })),
      sidebarHiddenKeys: [],
      sidebarNavPlacementFixes: [],
      sidebarKeepEmptyDivider: false,
      sidebarNameWithDivider: false,
      sidebarPlaylistOrder: { myLocal: [], myOnline: [], subscribed: [] },
      closeAction: "hide",
      rememberCloseChoice: false,
      fontFamily: "",
      showPerformanceMonitor: false,
    });

    const systemMotion = usePreferredReducedMotion();
    const reducedMotion = computed(
      () => appearance.reduceMotion || systemMotion.value === "reduce",
    );

    /** 播放器 */
    const player = reactive<PlayerSettings>({
      playerBgType: "blur",
      playerBgRenderer: "mesh",
      playerBgFps: 30,
      playerBgFlowSpeed: 4,
      playerBgRenderScale: 0.5,
      playerBgFreezeOnPause: false,
      coverLayout: "default",
      coverLyricRatio: 0.45,
      autoCenterCover: true,
      showPlaybackSource: false,
      followCoverColor: true,
      autoImmersive: true,
      outputDevice: null,
      pauseOnDeviceSwitch: false,
      rememberDeviceVolume: false,
      enableSpectrum: false,
      spectrumBarWidth: 4,
      reverseSpectrum: false,
      songLevel: "hq",
      allowTrialPlay: false,
      timeFormat: "current-total",
      showProgressTooltip: true,
      showProgressLyric: false,
      snapToLyric: false,
      showLyricInBar: true,
      preloadNextTrack: false,
      transitionMode: "none",
      transitionPreference: "standard",
      searchPlayBehavior: "current",
    });

    /** Miscellaneous display and playback preferences. */
    const preset = reactive<PresetSettings>({
      ignoreMusicGenre: true,
      skipKeywordsSongs: false,
      skipTrackKeywords: [...DEFAULT_SKIP_TRACK_KEYWORDS],
      hideQualityTag: false,
      showSubtitle: true,
    });

    /** 歌词 */
    const lyric = reactive<LyricSettings>({
      lyricSourcePreference: "auto",
      lyricSourceOrder: [...DEFAULT_LYRIC_SOURCE_ORDER],
      lyricFormatOrder: [...DEFAULT_LYRIC_FORMAT_ORDER],
      smartPreferOnline: false,
      preferPluginLyric: false,
      detectBackgroundLyrics: true,
      cjkTransform: "none",
      adaptiveFontSize: true,
      fontSize: 48,
      translationFontSize: 22,
      fontWeight: 700,
      showCredits: true,
      fontFamily: "",
      fontFamilyLatin: "",
      fontFamilyJapanese: "",
      fontFamilyKorean: "",
      fontFamilyChinese: "",
      showTranslation: true,
      showRuby: true,
      showRomanization: true,
      showWordRomanization: true,
      enableScale: true,
      bgAlwaysBelow: false,
      enableBlur: false,
      hidePassedLines: false,
      alignPosition: 0.35,
      wordFadeWidth: 0.5,
      enableExcludeLyrics: true,
      excludeLyricsUserKeywords: [],
      excludeLyricsUserRegexes: [],
      useAMSpring: true,
      amllVerticalSpringMass: 1,
      amllVerticalSpringDamping: 15,
      amllVerticalSpringStiffness: 100,
      amllVerticalSpringSoft: false,
      amllScaleSpringMass: 1,
      amllScaleSpringDamping: 20,
      amllScaleSpringStiffness: 100,
      amllScaleSpringSoft: false,
      amllCleanUnintentionalOverlaps: true,
      amllTryAdvanceStartTime: true,
      amllSyncMainAndBackgroundLines: true,
      amllNormalizeSpaces: true,
      amllResetLineTimestamps: true,
    });

    /** 系统配置 - 传递主进程 */
    const system = reactive<SystemConfig>(structuredClone(defaultSystemConfig));

    /**
     * 深合并：嵌套对象原地 mutate，叶子值不变就不写
     * 避免浅 Object.assign 替换嵌套引用，导致依赖路径的 watcher 误触
     */
    const deepAssign = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
      for (const key of Object.keys(source)) {
        const next = source[key];
        const cur = target[key];
        if (
          next &&
          typeof next === "object" &&
          !Array.isArray(next) &&
          cur &&
          typeof cur === "object" &&
          !Array.isArray(cur)
        ) {
          deepAssign(cur as Record<string, unknown>, next as Record<string, unknown>);
        } else if (cur !== next) {
          target[key] = next;
        }
      }
    };

    /** 从主进程拉取后端配置 */
    const syncSystem = async (): Promise<void> => {
      try {
        deepAssign(
          system as unknown as Record<string, unknown>,
          (await window.api.config.getAll()) as unknown as Record<string, unknown>,
        );
      } catch {}
    };

    /**
     * 写入后端配置并同步本地
     * 先就地 mutate 叶子保证 UI 即时反馈，IPC 落盘异步执行
     */
    const setSystem = async (keyPath: string, value: unknown): Promise<void> => {
      setByPath(system, keyPath, value);
      try {
        await window.api.config.set(keyPath, value);
      } catch (err) {
        console.error("[settings] config.set failed", keyPath, err);
      }
      if (keyPath === "player.fadeEnabled" || keyPath === "player.fadeDuration") {
        await window.api.player.setFadeDuration(
          system.player.fadeEnabled ? system.player.fadeDuration : 0,
        );
      }
    };

    return {
      locale,
      appearance,
      reducedMotion,
      player,
      preset,
      lyric,
      system,
      syncSystem,
      setSystem,
    };
  },
  {
    persist: {
      storage: localStorage,
      omit: ["system"],
      afterHydrate: ({ store }) => {
        const { lyric, appearance, preset, player } = store as unknown as {
          lyric: LyricSettings;
          appearance: AppearanceSettings;
          preset: PresetSettings;
          player: PlayerSettings;
        };
        if (player.transitionMode !== "crossfade") player.transitionMode = "none";
        if (
          player.transitionPreference !== "conservative" &&
          player.transitionPreference !== "eager"
        ) {
          player.transitionPreference = "standard";
        }
        // Discard retired display options so saved values cannot restore their behavior.
        delete (player as unknown as Record<string, unknown>).playerBgBeat;
        delete (preset as unknown as Record<string, unknown>).hideVipTag;
        // Remove persisted controls belonging to the retired lyric renderer.
        for (const key of [
          "lyricBlendMode",
          "engine",
          "alignment",
          "inactiveAlpha",
          "enableWordHighlight",
          "enableFloatAnimation",
          "enableEmphasizeEffect",
          "springPreset",
          "springMass",
          "springDamping",
          "springStiffness",
        ]) {
          delete (lyric as unknown as Record<string, unknown>)[key];
        }
        if (typeof lyric.detectBackgroundLyrics !== "boolean") {
          lyric.detectBackgroundLyrics = true;
        }
        if (typeof preset.ignoreMusicGenre !== "boolean") preset.ignoreMusicGenre = true;
        if (!Array.isArray(preset.skipTrackKeywords)) {
          preset.skipTrackKeywords = [...DEFAULT_SKIP_TRACK_KEYWORDS];
        }
        lyric.lyricSourceOrder = reconcileOrder(lyric.lyricSourceOrder, ALL_PLATFORMS);
        lyric.lyricFormatOrder = reconcileOrder(lyric.lyricFormatOrder, DEFAULT_LYRIC_FORMAT_ORDER);
        appearance.songListColumnOrder = normalizeSongListColumnOrder(
          appearance.songListColumnOrder,
        );
        appearance.songListHiddenColumns = normalizeSongListHiddenColumns(
          appearance.songListHiddenColumns,
        );
        appearance.sidebarNavGroups = reconcileNavGroups(appearance.sidebarNavGroups ?? []);
        appearance.sidebarNavPlacementFixes = applyNavPlacementFixes(
          appearance.sidebarNavGroups,
          appearance.sidebarNavPlacementFixes,
        );
        appearance.sidebarHiddenKeys = reconcileHiddenKeys(appearance.sidebarHiddenKeys ?? []);
        appearance.sidebarPlaylistOrder = reconcilePlaylistOrder(appearance.sidebarPlaylistOrder);
      },
    },
  },
);
