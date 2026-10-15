import type { Track } from "@shared/types/player";

/**
 * 从流媒体服务器请求歌词
 * @param track - 歌曲信息
 * @returns 服务端歌词，不存在则返回 null
 */
export const requestStreamingLyric = async (track: Track): Promise<string | null> => {
  if (track.source !== "streaming" || !track.serverId || !track.originalId) return null;
  try {
    return await window.api.streaming.getLyrics(track.serverId, track.originalId, {
      artist: track.artists[0]?.name,
      title: track.title,
    });
  } catch (err) {
    console.warn("[streaming] getLyrics failed:", err);
    return null;
  }
};
