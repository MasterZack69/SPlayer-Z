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

/** 选中的来源：曲目 + 代表曲目下标 */
interface HeroSource {
  kind: HeroKind;
  /** 代表曲目下标：决定封面、daily 标题歌名、立即播放的起点 */
  featuredIndex: number;
  tracks: Track[];
}

/** 本地曲库随机取曲数 */
const LOCAL_RANDOM_LIMIT = 50;

/** hero 队列预览展示曲目数 */
const HERO_PREVIEW_COUNT = 4;

/** 随机下标 */
const randomIndex = (length: number): number => Math.floor(Math.random() * length);

/** 曲目组装成来源，空则返回 null */
const toSource = (kind: HeroKind, tracks: Track[]): HeroSource | null =>
  tracks.length > 0 ? { kind, featuredIndex: randomIndex(tracks.length), tracks } : null;

/**
 * 从本地曲库构建首页播放卡片
 * @returns 卡片状态与播放操作
 */
export const useDailyRecommend = () => {
  const { t } = useI18n();

  const slide = shallowRef<HeroSource | null>(null);
  const loading = ref(true);

  /** 当前展示内容 */
  const hero = computed<HeroContent | null>(() => {
    const current = slide.value;
    if (!current) return null;
    const featured = current.tracks[current.featuredIndex];
    return {
      kind: current.kind,
      tag: t(`home.hero.${current.kind}.tag`),
      title: t(`home.hero.${current.kind}.title`, { song: featured?.title ?? "" }),
      subtitle: t(`home.hero.${current.kind}.subtitle`, { count: current.tracks.length }),
      cover: featured?.cover,
    };
  });

  /** hero 队列预览曲目：从代表曲目（封面/标题所示那首）起，截取展示数 */
  const previewTracks = computed<Track[]>(() => {
    const current = slide.value;
    if (!current) return [];
    return Array.from(
      { length: Math.min(HERO_PREVIEW_COUNT, current.tracks.length) },
      (_, index) => current.tracks[(current.featuredIndex + index) % current.tracks.length],
    );
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

  /** 立即播放：从代表曲目起播整组 */
  const playAll = async (): Promise<void> => {
    const current = slide.value;
    if (!current || current.tracks.length === 0) {
      toast.warning(t("home.hero.empty"));
      return;
    }
    await player.playFrom(current.tracks, { startIndex: current.featuredIndex });
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
