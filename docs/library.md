# Library and metadata

## Local library

Add music directories during setup or through the library's folder-management controls. Scan the selected directories to populate Library, Artists, Albums, Genres, and Folders. Refresh the index after changing tags or files outside the application.

These pages describe the same indexed music; they are not separate online catalogs. Liked Songs and local playlists organize that music without a platform login.

## Shared song tables

Song-list pages use the shared `SongList` component rather than maintaining independent row layouts. The available columns include track number, title and artist, album, genre, actions, duration, and file size. Context can omit a redundant column, such as Album when viewing a single album. Header and row widths stay aligned, with responsive spacing for narrow views.

The top search field filters the current page. Library does not have a second, competing search field. Search on Home is global instead; see [Search](search.md).

## Artist names

Local metadata parsing recognizes common separators between artists. Names containing those characters need explicit exceptions when the entire name represents one artist. **Royal & the Serpent** is preserved as one artist, including when it appears alongside other credits.

The exception list lives in `electron/main/utils/metadata.ts`, with regression cases in `metadata.test.ts`. Add a narrowly scoped exception and tests for standalone names and mixed credits; do not disable splitting for every ampersand. Media-server artist values are authoritative and are not split again by the client.

## Covers

Local covers come from audio metadata. FLAC cover extraction includes a bounded PICTURE-block fallback for files whose picture metadata cannot be handled by the normal decoder path, including malformed MIME metadata. Server covers are fetched through an authenticated main-process proxy. Local artist-avatar lookup can also query MusicBrainz and TheAudioDB and cache the returned artwork; it is separate from audio playback and does require network access.

A missing cover can still mean there is no embedded picture, the file is damaged, or the server cannot provide it. Include a legally shareable sample or metadata details when reporting extraction errors.

## Storage and safety

The local index and playlists are in SQLite. Queue data is persisted separately in renderer storage. Clearing an index or application data is not the same as deleting your music, but it can remove playlists, preferences, and recorded statistics. Back up the application data before a reset; see [Debugging](troubleshooting/debug.md).
