# Architecture

## Process boundaries

- `electron/main/`: windows, configuration, SQLite, server adapters, native modules, and IPC handlers.
- `electron/preload/`: the typed `window.api` bridge. Event subscriptions return per-handler cleanup functions.
- `src/`: Vue 3 renderer, Pinia stores, player coordination, and user interface.
- `shared/`: cross-process types, defaults, constants, and protocol definitions.
- `native/`: Rust NAPI-RS modules; see [Native modules](native.md).

`electron/main/ipc/index.ts` is the registration source of truth. Legacy files, types, defaults, or preload names can remain after a feature is disabled; they are not a supported public API. There is no supported external HTTP, WebSocket, or MCP control service in this fork.

## Playback and state

User actions pass through `src/core/player`, then the preload bridge and main player IPC to `audio-engine`. Native state, position, completion, and output events update main-process services and renderer stores.

`src/stores/status.ts` provides low-frequency reactive playback state. `src/services/playback.ts` interpolates the time source for animation without pushing every frame through Vue. `src/stores/media.ts` holds the current lightweight track and on-demand detail; large lyric strings must not be persisted as `TrackDetail` in session storage.

Queue entry identity is separate from track identity. `useQueuePanel` shares queue actions, `useDragSort` handles interaction, and core player operations preserve the currently playing entry during reorder. See [Queue](queue.md).

## Library and search

Local scanning builds the SQLite library index. Local playlists also live in SQLite; old renderer playlist storage is migration-only. The shared `SongList` keeps column headers and rows consistent across song-list contexts.

`SongList` sorting is persisted by a finite page-category key in the status store, not globally or per individual album/playlist ID. Library, Folders, Liked Songs, Artists, and collection types (including Genres) keep independent preferences. Unkeyed lists keep sorting component-local. The old global sort is intentionally not migrated; each category initially uses its original order.

Home search uses categorized local and active-server indexes. Other pages use route-bound filters through `usePageSearch`. No renderer request should bypass the main-process authentication boundary to search a media server.

Home contains library statistics and listening insights below the random-track selection. Keep those queries local and avoid reintroducing a separate Stats page.

## Media servers

`electron/main/services/streaming/` contains server configuration, connection handling, adapters, cover proxying, synchronization, and playback sessions. Complete staging snapshots publish atomically. Server identity and media revisions isolate playback and downloads across configuration changes.

Server responses are authoritative for artist fields and favorites. Reports follow native playback events, not preloads or downloads. See [Media servers](streaming.md).

## Lyrics and player surfaces

Local sidecars and embedded data resolve under `src/services/lyric/`; configured servers may provide lyrics. `src/utils/lyric/` handles normalization and safe emphasis formatting. AMLL is the only full-player lyric engine. Lyrics use Normal blending without a blend-mode selector. Fluid backgrounds animate independently of the beat and do not acquire FFT capture; the optional spectrum remains a separate consumer.

Initialize the fluid background during player entry. Guard asynchronous cover completion against stale tracks and dispose renderers and animation frames when the surface closes. Do not use a blurred-cover preview as the first fluid frame.

## Configuration and storage

Settings are declared in `src/settings/schema.ts`, with category implementations under `src/settings/categories/`. Items bind to renderer stores or main configuration paths. Shared defaults are in `shared/defaults/`.

`electron/main/utils/paths.ts` defines `{userData}/app-data/`:

```text
config/             settings.json, streaming.json, lastfm.json
database/           library.db
cache/              covers, artists, backgrounds
logs/               application and native diagnostics
```

Renderer IndexedDB stores include `splayer-z/library` and `splayer-z/queue`. Store raw lightweight data, not Vue proxies. The Linux profile is `${XDG_CONFIG_HOME:-$HOME/.config}/SPlayer-Z`; no other player's profile is imported.

## Localization and integration

English is the default renderer and main-process locale. A saved language choice takes precedence. The first setup page chooses language before the remaining steps.

Linux MPRIS system media controls and optional Last.fm remain supported integrations. Only x86_64 and ARM64 Linux are supported. The Windows/macOS backends, taskbar integrations, and retired external lyric windows are removed. Linux uses CPAL output, PipeWire device monitoring, and MPRIS media controls.

### Calendar years

The scanner interprets FFmpeg date/year tags as calendar years, without timezone conversion.
It accepts four-digit years, year-month dates, validated year-first or year-last numeric dates,
compact `YYYYMMDD`, and ISO timestamps. Unknown, zero, malformed values, original-release-only
tags, file timestamps, and incidental numbers in comments are not used as substitutes.
Normalized `date` takes priority over `year`; invalid candidates fall through to recognized
format-specific aliases. FFmpeg can normalize distinct ID3 date frames to the same key, so
this layer cannot reconstruct distinctions already lost by the demuxer.

A database row records whether year parsing has run, independently of whether a year exists.
Upgraded files are re-read once by the next startup scan; cancellation or unavailable directories
leave pending rows eligible for a later scan. Incremental records retain all existing paths for
deleted-file detection. CUE tracks inherit the container year and are refreshed once as well.

Shared song lists include a Year column between Genre and Actions, support year filtering and
scoped sorting, and place unknown years last in either sort direction. Album pages and local
album cards show distinct known years in ascending order separated by `/`. The Years browser
is a text-only list across the local and active-server indexes; selecting a year opens its tracks.
Year values in shared song lists open the matching year group; missing years open Unknown Year.
Local songs without genre tags link to Unknown Genre. Global search includes Years and matches song/album years. Media-server years use the server's
authoritative numeric metadata. No year is added to Now Playing.

Home keeps the overview row, then shows Songs by Year alongside Audio Formats. Listening
Activity and Listening Hours share the following row. The year chart counts local tracks with
known years, excludes hidden CUE containers, labels missing-year coverage, and scrolls horizontally
for long year histories, with mouse-wheel, trackpad, and keyboard navigation. The graph fits
its viewport vertically and hides scrollbar chrome; listening statistics and top lists retain
their existing semantics.

Genre and year browsers include localized unknown entries when tracks lack that metadata.
Unknown Genre contains local tracks without a nonblank genre. Unknown Year contains local and
active-server tracks without a valid track or album year. These are virtual groups, not tags
written to files; a real genre named "Unknown genre" stays separate. Year statistics continue
to count only known numeric years.
