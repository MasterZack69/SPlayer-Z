import { normalizeGenre } from "@shared/utils/genre";
import { getTrackYear } from "@shared/utils/year";
import localforage from "localforage";
import type { Track, Artist } from "@shared/types/player";
import type {
  AlbumSummary,
  ArtistSummary,
  GenreSummary,
  ScanProgress,
} from "@shared/types/library";
import type { Collection } from "@/types/collection";
import type { ArtistProfile, CoverItem } from "@/types/artist";
import { buildFolderTree, countFolders } from "@/utils/folderTree";

const trackDb = localforage.createInstance({ name: "splayer-z", storeName: "library" });

/** 本地喜欢 id 在 trackDb 内的持久化 key */
const LIKED_IDS_KEY = "liked-ids";

export const useLibraryStore = defineStore("library", () => {
  /** 曲目列表 */
  const tracks = shallowRef<Track[]>([]);
  /** 扫描目录列表 */
  const scanDirs = ref<string[]>([]);
  /** 是否正在扫描 */
  const scanning = ref(false);
  /** 扫描进度 */
  const scanProgress = ref<ScanProgress | null>(null);
  /** 是否已初始化 */
  const initialized = ref(false);
  /** 歌手头像缓存 */
  const artistAvatars = shallowRef<Record<string, string>>({});
  /** 本地红心 id */
  const likedOrderedIds = shallowRef<string[]>([]);
  /** 本地红心 id 集合 */
  const likedIdSet = shallowRef<Set<string>>(new Set());

  /** 持久化喜欢列表 */
  const persistLiked = (): void => {
    trackDb.setItem(LIKED_IDS_KEY, [...likedOrderedIds.value]).catch(() => {});
  };

  /** 是否已收藏 */
  const isLiked = (trackId: string): boolean => likedIdSet.value.has(trackId);

  /**
   * 切换收藏
   * @param trackId 歌曲 id
   */
  const toggleLike = (trackId: string): boolean => {
    if (!trackId) return false;
    const next = new Set(likedIdSet.value);
    if (next.has(trackId)) {
      next.delete(trackId);
      likedOrderedIds.value = likedOrderedIds.value.filter((id) => id !== trackId);
    } else {
      next.add(trackId);
      likedOrderedIds.value = [trackId, ...likedOrderedIds.value];
    }
    likedIdSet.value = next;
    persistLiked();
    return next.has(trackId);
  };

  /** 标准化歌手名 */
  const normalizeArtistName = (name: string): string => name.trim().toLowerCase();

  /**
   * 获取歌手头像
   * @param artistName 歌手名
   */
  const getArtistAvatar = (artistName: string): string | undefined => {
    const key = normalizeArtistName(artistName);
    if (!key) return;
    return artistAvatars.value[key];
  };

  /**
   * 设置歌手头像
   * @param artistName 歌手名
   * @param avatar 歌手头像
   */
  const setArtistAvatar = (artistName: string, avatar: string): void => {
    const key = normalizeArtistName(artistName);
    if (!key || !avatar) return;
    if (artistAvatars.value[key] === avatar) return;
    artistAvatars.value = { ...artistAvatars.value, [key]: avatar };
  };

  /** 批量预取头像 */
  const loadArtistAvatars = async (): Promise<void> => {
    const list = await getArtistList();
    const names = list
      .filter((item) => !artistAvatars.value[normalizeArtistName(item.name)])
      .map((item) => item.name);
    if (!names.length) return;
    const res = await window.api.library.prefetchArtistAvatars(names);
    if (!res.success || !res.data) return;
    const patch: Record<string, string> = {};
    for (const [key, avatar] of Object.entries(res.data)) {
      if (avatar) patch[key] = avatar;
    }
    if (Object.keys(patch).length > 0) {
      artistAvatars.value = { ...artistAvatars.value, ...patch };
    }
  };

  /** 将曲目写入 IndexedDB 缓存 */
  const cacheTracks = (items: Track[]): void => {
    trackDb.setItem("tracks", toRaw(items)).catch(() => {});
  };

  let loadPromise: Promise<void> | null = null;

  /** Share in-flight library loads so setup and startup cannot overwrite each other. */
  const load = (): Promise<void> => {
    if (!loadPromise) {
      loadPromise = loadLibrary().finally(() => {
        loadPromise = null;
      });
    }
    return loadPromise;
  };

  /** Load cached likes and tracks, then synchronize the authoritative local index. */
  const loadLibrary = async (): Promise<void> => {
    // Display cached tracks while loading the authoritative index.
    const [cached, likedCached] = await Promise.all([
      trackDb.getItem<Track[]>("tracks").catch(() => null),
      trackDb.getItem<string[]>(LIKED_IDS_KEY).catch(() => null),
    ]);
    if (cached?.length) tracks.value = cached;
    if (Array.isArray(likedCached)) {
      likedOrderedIds.value = likedCached;
      likedIdSet.value = new Set(likedCached);
    }
    // Replace the cache with the current database snapshot.
    const [tracksRes, dirsRes] = await Promise.all([
      window.api.library.getTracks(),
      window.api.library.getScanDirs(),
    ]);
    if (tracksRes.success && tracksRes.data) {
      tracks.value = tracksRes.data;
      cacheTracks(tracksRes.data);
    }
    if (dirsRes.success && dirsRes.data) scanDirs.value = dirsRes.data;
    initialized.value = true;
    void loadArtistAvatars().catch(console.error);
  };

  let pendingScan: boolean | null = null;

  /**
   * Start indexing with a process-lifetime listener; queue folders added during an active scan.
   * @param incremental - Skip files whose metadata has not changed.
   */
  const startScan = async (incremental = true): Promise<void> => {
    subscribeScanProgress();
    if (scanning.value) {
      pendingScan = pendingScan === false ? false : incremental;
      return;
    }
    scanning.value = true;
    scanProgress.value = { phase: "scanning", total: 0, scanned: 0 };
    try {
      const res = await window.api.library.scan(incremental);
      if (!res.success) {
        scanning.value = false;
        scanProgress.value = null;
      }
    } catch {
      scanning.value = false;
      scanProgress.value = null;
    }
  };

  /** Cancel indexing and discard any queued follow-up scan. */
  const cancelScan = async (): Promise<void> => {
    pendingScan = null;
    await window.api.library.cancelScan();
    scanning.value = false;
    scanProgress.value = null;
  };

  /** Add a music directory and index it immediately, including during onboarding. */
  const addScanDir = async (): Promise<{ success: boolean; error?: string }> => {
    await initialize();
    const res = await window.api.library.addScanDir();
    if (res.success) {
      const newDir = res.data as string;
      const nested = scanDirs.value.some(
        (d) =>
          newDir.startsWith(d + "\\") ||
          newDir.startsWith(d + "/") ||
          d.startsWith(newDir + "\\") ||
          d.startsWith(newDir + "/"),
      );
      if (nested) {
        await window.api.library.removeScanDir(newDir);
        if (scanning.value) {
          scanning.value = false;
          pendingScan = null;
          await startScan();
        }
        return { success: false, error: "nested" };
      }
      scanDirs.value = [...scanDirs.value, newDir];
      await startScan();
    }
    return res;
  };

  /**
   * Remove a directory and refresh the remaining index after backend cancellation.
   * @param dir - Configured music directory to remove.
   */
  const removeScanDir = async (dir: string): Promise<void> => {
    pendingScan = null;
    await window.api.library.removeScanDir(dir);
    scanDirs.value = scanDirs.value.filter((d) => d !== dir);
    // The backend cancels the active scan before deleting directory tracks.
    if (scanning.value) {
      scanning.value = false;
      scanProgress.value = null;
    }
    const res = await window.api.library.getTracks();
    if (res.success && res.data) {
      tracks.value = res.data;
      cacheTracks(res.data);
      void loadArtistAvatars().catch(console.error);
    }
  };

  let unsubscribe: (() => void) | null = null;
  let initializePromise: Promise<void> | null = null;

  /** Install one application-level listener, independent of page mount/unmount. */
  const subscribeScanProgress = (): void => {
    if (unsubscribe) return;
    unsubscribe = window.api.library.onScanProgress((data) => {
      scanProgress.value = data;
      if (data.phase === "scanning") scanning.value = true;
      else void finishScan(data);
    });
  };

  /**
   * Refresh the index after scanning and start any requested follow-up pass.
   * @param progress - Terminal scanner event.
   */
  const finishScan = async (progress: ScanProgress): Promise<void> => {
    try {
      if (progress.phase === "done") {
        await loadPromise;
        const res = await window.api.library.getTracks();
        if (res.success && res.data) {
          tracks.value = res.data;
          cacheTracks(res.data);
          void loadArtistAvatars().catch(console.error);
        }
      }
    } catch (error) {
      console.error("[library] Failed to refresh scanned tracks", error);
    } finally {
      scanning.value = false;
      const next = pendingScan;
      pendingScan = null;
      if (next !== null) void startScan(next);
    }
  };

  /** Load the index and begin one startup scan without waiting for Library navigation. */
  const initialize = (): Promise<void> => {
    if (!initializePromise) {
      subscribeScanProgress();
      initializePromise = (async () => {
        await load();
        if (scanDirs.value.length > 0) await startScan(tracks.value.length > 0);
      })().catch((error) => {
        initializePromise = null;
        throw error;
      });
    }
    return initializePromise;
  };

  onScopeDispose(() => unsubscribe?.());

  /** 删除曲目文件并刷新列表 */
  const deleteTracks = async (paths: string[]): Promise<{ deleted: number; failed: number }> => {
    const res = await window.api.library.deleteTracks(paths);
    if (res.success) {
      // 找出被删歌曲的 id，用于裁喜欢
      const pathSet = new Set(paths);
      const deletedIds = new Set(
        tracks.value.filter((t) => t.path && pathSet.has(t.path)).map((t) => t.id),
      );
      // 从本地列表中移除已删除的曲目
      const remaining = tracks.value.filter((t) => !t.path || !pathSet.has(t.path));
      tracks.value = remaining;
      cacheTracks(remaining);
      // 同步剪掉失效的喜欢 id
      if (deletedIds.size > 0 && likedOrderedIds.value.some((id) => deletedIds.has(id))) {
        const filtered = likedOrderedIds.value.filter((id) => !deletedIds.has(id));
        likedOrderedIds.value = filtered;
        likedIdSet.value = new Set(filtered);
        persistLiked();
      }
      return res.data ?? { deleted: 0, failed: paths.length };
    }
    return { deleted: 0, failed: paths.length };
  };

  /**
   * 按 id 替换曲目数据并回写缓存（标签编辑后调用）
   * @param updates 更新后的 Track 列表
   */
  const applyTrackUpdates = (updates: Track[]): void => {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((item) => [item.id, item]));
    if (!tracks.value.some((item) => byId.has(item.id))) return;
    tracks.value = tracks.value.map((item) => byId.get(item.id) ?? item);
    cacheTracks(tracks.value);
  };

  /** 文件夹树：按磁盘路径聚合，详见 utils/folderTree */
  const folderTree = computed(() => buildFolderTree(tracks.value, scanDirs.value));

  /** 文件夹总数（递归） */
  const folderCount = computed(() => countFolders(folderTree.value));

  /** 专辑聚合列表 */
  const getAlbumList = async (): Promise<AlbumSummary[]> => {
    const res = await window.api.library.getAlbums();
    return res.success && res.data ? res.data : [];
  };

  /** 歌手聚合列表 */
  const getArtistList = async (): Promise<ArtistSummary[]> => {
    const res = await window.api.library.getArtists();
    return res.success && res.data ? res.data : [];
  };

  /** 流派聚合列表 */
  const getGenreList = async (): Promise<GenreSummary[]> => {
    const res = await window.api.library.getGenres();
    return res.success && res.data ? res.data : [];
  };

  /**
   * Load a genre collection using canonical browsing labels and unmodified track tags.
   * @param genreName - Requested genre label or alias.
   * @returns Matching local collection, or null when no tracks exist.
   */
  const getGenreCollection = async (genreName: string): Promise<Collection | null> => {
    const name = normalizeGenre(genreName);
    if (!name) return null;
    const res = await window.api.library.getGenreTracks(name);
    if (!res.success || !res.data?.length) return null;
    const genreTracks = res.data;
    // Preserve source capitalization for genres outside the explicit alias list.
    const displayName =
      genreTracks
        .flatMap((track) => track.genres ?? [])
        .map(normalizeGenre)
        .find((item) => item.toLowerCase() === name.toLowerCase()) ?? name;
    return {
      id: encodeURIComponent(displayName),
      type: "genre",
      source: "local",
      title: displayName,
      cover: genreTracks.find((track) => track.cover)?.cover,
      tracks: genreTracks,
      trackCount: genreTracks.length,
    };
  };

  /** 专辑详情 */
  const getAlbumCollection = async (albumName: string): Promise<Collection | null> => {
    const res = await window.api.library.getAlbumTracks(albumName);
    if (!res.success || !res.data?.length) return null;
    const albumTracks = res.data;
    const artistMap = new Map<string, Artist>();
    for (const t of albumTracks) {
      for (const a of t.artists) {
        const key = a.name.toLowerCase();
        if (!artistMap.has(key)) artistMap.set(key, a);
      }
    }
    return {
      id: encodeURIComponent(albumName),
      type: "album",
      source: "local",
      title: albumName,
      cover: albumTracks.find((t) => t.cover)?.cover,
      artists: [...artistMap.values()],
      tracks: albumTracks,
      trackCount: albumTracks.length,
    };
  };

  /** 歌手详情 */
  const getArtistProfile = async (artistName: string): Promise<ArtistProfile | null> => {
    const name = artistName.trim();
    if (!name) return null;
    const res = await window.api.library.getArtistTracks(name);
    if (!res.success || !res.data?.length) return null;
    const artistTracks = res.data;
    const albumMap = new Map<string, { cover?: string; count: number; years: Set<number> }>();
    for (const t of artistTracks) {
      if (!t.album?.name) continue;
      const key = t.album.name;
      const existing = albumMap.get(key);
      if (existing) {
        existing.count++;
        const year = getTrackYear(t);
        if (year !== undefined) existing.years.add(year);
        if (!existing.cover && t.cover) existing.cover = t.cover;
      } else {
        albumMap.set(key, {
          cover: t.cover,
          count: 1,
          years: new Set(getTrackYear(t) === undefined ? [] : [getTrackYear(t)!]),
        });
      }
    }
    const albums: CoverItem[] = [...albumMap.entries()].map(([albumName, info]) => ({
      id: encodeURIComponent(albumName),
      title: albumName,
      cover: info.cover,
      years: [...info.years].sort((a, b) => a - b),
      trackCount: info.count,
    }));
    return {
      id: encodeURIComponent(name),
      name,
      avatar: getArtistAvatar(name),
      source: "local",
      tracks: artistTracks,
      albums,
      trackCount: artistTracks.length,
      albumCount: albums.length,
    };
  };

  return {
    tracks,
    scanDirs,
    scanning,
    scanProgress,
    initialized,
    artistAvatars,
    likedOrderedIds,
    likedIdSet,
    isLiked,
    toggleLike,
    load,
    startScan,
    cancelScan,
    addScanDir,
    removeScanDir,
    subscribeScanProgress,
    initialize,
    deleteTracks,
    applyTrackUpdates,
    getArtistAvatar,
    setArtistAvatar,
    loadArtistAvatars,
    getArtistList,
    getAlbumList,
    getGenreList,
    getGenreCollection,
    getAlbumCollection,
    getArtistProfile,
    folderTree,
    folderCount,
  };
});
