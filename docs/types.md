# Internal type reference

This page describes types used inside SPlayer-Z. It is not a plugin SDK or a public HTTP, WebSocket, or MCP API. Use the actual TypeScript definitions as the source of truth; do not copy stale declarations into clients.

## Shared definitions

| Source                      | Important definitions and use                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `shared/types/player.ts`    | `Track`, `TrackDetail`, `Artist`, `Album`, `Playlist`, `AudioQuality`, playback state and queue context    |
| `shared/types/lyrics.ts`    | Re-exported `lyric-kit` types, lyric sources, supported format order                                       |
| `shared/types/streaming.ts` | Server configuration, safe renderer views, connection results, synchronized snapshots and favorite updates |
| `shared/types/playlist.ts`  | Local playlist summaries, details, creation and update inputs                                              |
| `shared/types/stats.ts`     | Library totals, playback events, daily/hourly activity, and top tracks/albums/artists                      |
| `shared/types/settings.ts`  | Cross-process application configuration                                                                    |

Some unions and declarations still contain legacy platform or lyric-source values for compatibility. Their presence does not enable removed platform playback, online lyric matching, or a public endpoint. Follow the active resolver and registered IPC handlers.

## Tracks and queue entries

`Track` is the lightweight identity and metadata object used by lists and queues. `TrackDetail` holds on-demand details such as lyrics and quality; do not persist the whole detail object in session storage. Use `shallowRef` for large track arrays.

Server tracks retain `serverId`, the original server resource identity, and media revision information. Identical server resource IDs on different servers must not collide. Queue entries add per-entry identity because duplicate tracks can coexist in one queue.

## Lyrics

`LyricLine`, `LyricWord`, and `LyricSpan` come from `lyric-kit`. Preserve timing and source-text offsets when normalizing compact LRC or adding emphasis. The `external` lyric source is used for local sidecar files and lyrics returned by the configured media server; it does not mean public online lyric lookup. See [Lyrics](lyrics.md).

## Native interfaces and IPC

Import generated native bindings from `@splayer/*`. NAPI-RS owns `native/*/index.d.ts`; never maintain copies by hand.

Cross-process request/response definitions belong in `shared/types/`, with matching preload methods and main handlers. Event subscriptions return a cleanup function that removes only that callback. Finite-lifetime renderer consumers must call it on unmount; do not remove every listener on a shared channel.

JavaScript/UI time values are milliseconds. The Rust engine uses seconds internally; keep conversions at the boundary explicit.
