import type { Track } from "@shared/types/player";
import { toast } from "@/composables/useToast";
import * as player from "@/core/player";

/** hero 源类型 */
type HeroKind = "local";

/** hero 渲染内容 */
export interface HeroContent {
  kind: HeroKind;
  /** 角标文案 */
  tag: string;
  /** 主标题 */
  title: string;
  /** 副标题 */
  subtitle: string;
  /** 封面 */
  cover?: string;
}

/** Selected source in featured-first playback order. */
interface HeroSource {
  kind: HeroKind;
  tracks: Track[];
}

/** 本地曲库随机取曲数 */
const LOCAL_RANDOM_LIMIT = 50;

/** hero 队列预览展示曲目数 */
const HERO_PREVIEW_COUNT = 4;

/** 随机下标 */
const randomIndex = (length: number): number => Math.floor(Math.random() * length);

/** Build one queue order shared by the card, preview, and playback.
 * @param kind - Library source kind.
 * @param tracks - Random library selection, left unchanged.
 * @returns Selection rotated to put its featured track first, or null when empty.
 */
const toSource = (kind: HeroKind, tracks: Track[]): HeroSource | null => {
  if (tracks.length === 0) return null;
  const start = randomIndex(tracks.length);
  return { kind, tracks: [...tracks.slice(start), ...tracks.slice(0, start)] };
};

/**
 * Build the Home playback card from the local library.
 * @returns Card state and featured-first queue actions.
 */
export const useDailyRecommend = () => {
  const { t } = useI18n();

  const slide = shallowRef<HeroSource | null>(null);
  const loading = ref(true);

  /** 当前展示内容 */
  const hero = computed<HeroContent | null>(() => {
    const current = slide.value;
    if (!current) return null;
    const featured = current.tracks[0];
    return {
      kind: current.kind,
      tag: t(`home.hero.${current.kind}.tag`),
      title: t(`home.hero.${current.kind}.title`, { song: featured?.title ?? "" }),
      subtitle: t(`home.hero.${current.kind}.subtitle`, { count: current.tracks.length }),
      cover: featured?.cover,
    };
  });

  /** Preview the beginning of the same queue used by Play now. */
  const previewTracks = computed<Track[]>(() => {
    const current = slide.value;
    if (!current) return [];
    return current.tracks.slice(0, HERO_PREVIEW_COUNT);
  });

  /** 构建单个来源，失败返回 null */
  const tryBuild = async (kind: HeroKind): Promise<HeroSource | null> => {
    try {
      const res = await window.api.library.getRandomTracks(LOCAL_RANDOM_LIMIT);
      return toSource("local", res.success ? (res.data ?? []) : []);
    } catch (error) {
      console.warn(`[home] hero source ${kind} failed:`, error);
      return null;
    }
  };

  let loadGeneration = 0;

  /** Refresh the random local selection without allowing older requests to replace it. */
  const load = async (): Promise<void> => {
    loading.value = true;
    const generation = ++loadGeneration;
    const built = await tryBuild("local");
    if (generation !== loadGeneration) return;
    slide.value = built;
    loading.value = false;
  };

  /** Start the featured track at the head of the replacement queue. */
  const playAll = async (): Promise<void> => {
    const current = slide.value;
    if (!current || current.tracks.length === 0) {
      toast.warning(t("home.hero.empty"));
      return;
    }
    await player.playFrom(current.tracks, { startIndex: 0 });
  };

  /** 添加到队列：整组插入当前曲目之后 */
  const addToQueue = (): void => {
    const current = slide.value;
    if (!current || current.tracks.length === 0) {
      toast.warning(t("home.hero.empty"));
      return;
    }
    const added = player.insertManyToQueue(current.tracks);
    if (added > 0) toast.success(t("home.hero.added", { count: added }));
  };

  return { hero, loading, previewTracks, playAll, addToQueue, load };
};
