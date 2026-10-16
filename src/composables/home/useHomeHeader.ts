import type { PlayStatsSummary } from "@shared/types/stats";

/** 单个统计卡片 */
export interface HeaderStat {
  value: string;
  unit: string;
  label: string;
}

/** Provide the time-of-day greeting and listening statistics for Home. */
export const useHomeHeader = () => {
  const { t } = useI18n();

  /** 按时段问候 key */
  const greetingKey = computed(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "home.greeting.dawn";
    if (hour < 12) return "home.greeting.morning";
    if (hour < 14) return "home.greeting.noon";
    if (hour < 18) return "home.greeting.afternoon";
    return "home.greeting.evening";
  });

  /** 按本地时间显示问候语 */
  const greetingTitle = computed(() => t(greetingKey.value));

  const stats = ref<PlayStatsSummary | null>(null);

  /** 右侧三项统计 */
  const headerStats = computed<HeaderStat[]>(() => {
    const data = stats.value;
    return [
      {
        value: data ? (data.weekListenedMs / 3600000).toFixed(1) : "0",
        unit: t("home.stats.unitHour"),
        label: t("home.stats.weekDuration"),
      },
      {
        value: String(data?.weekFavoriteAdds ?? 0),
        unit: t("home.stats.unitSong"),
        label: t("home.stats.newFavorites"),
      },
      {
        value: String(data?.streakDays ?? 0),
        unit: t("home.stats.unitDay"),
        label: t("home.stats.listenStreak"),
      },
    ];
  });

  /** Load the listening summary without fetching history for removed subtitles. */
  const load = async (): Promise<void> => {
    try {
      stats.value = await window.api.stats.getStatsSummary();
    } catch (error) {
      console.warn("[home] getStatsSummary failed:", error);
    }
  };

  return { greetingTitle, headerStats, load };
};
