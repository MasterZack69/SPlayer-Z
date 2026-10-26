# Library and metadata

## Local library

Add music directories during setup or through the library's folder-management controls. Indexing starts automatically when a directory is added, including during setup. It continues in the background after setup; Home's random selection and statistics update when the scan finishes, without opening Library. Setup and Home display scan progress while indexing. Existing directories receive an incremental scan at application startup. Use Library's refresh controls after changing tags or files outside the application.

These pages describe the same indexed music; they are not separate online catalogs. Liked Songs and local playlists organize that music without a platform login.

## Shared song tables

Song-list pages use the shared `SongList` component rather than maintaining independent row layouts. The available columns include track number, title and artist, album, genre, actions, duration, and file size. Context can omit a redundant column, such as Album when viewing a single album. Header and row widths stay aligned, with responsive spacing for narrow views.

The top search field filters the current page. Library does not have a second, competing search field. Search on Home is global instead; see [Search](search.md).

## Generic Music genre

**Other → Miscellaneous → Ignore “Music” Genre** is enabled by default. It hides the exact
`Music` label (case-insensitive, ignoring surrounding spaces) from song lists, Now Playing, genre browsing,
genre search, and genre statistics. `Electronic Music`, `Podcast`, and other distinct labels
remain unchanged. A track with only `Music` appears under Unknown Genre while this is enabled.

Turn the switch off to restore `Music` when the distinction is useful, such as a mixed music
and podcast library. Changes apply without rescanning. The preference is saved between launches;
original tags remain untouched in the index, tag editor, and music files.

## Saved sorting

Sort choices survive app restarts until changed by the user. Artist, album, and genre browsers
keep independent modes; the year wheel keeps its own ascending/descending preference. Song tables
retain their field and direction independently by page category. Restoring a preference never
reorders the playback queue. The year wheel's selected year remains session-only, separate from
its permanently saved sort direction.

## Artist names

Local metadata parsing recognizes common separators between artists. Names containing those characters need explicit exceptions when the entire name represents one artist. **Royal & the Serpent** is preserved as one artist, including when it appears alongside other credits.

The exception list lives in `electron/main/utils/metadata.ts`, with regression cases in `metadata.test.ts`. Add a narrowly scoped exception and tests for standalone names and mixed credits; do not disable splitting for every ampersand. Media-server artist values are authoritative and are not split again by the client.

## Genre aliases

Genre browsing groups known equivalent tags such as **Rap/Hip Hop**, **Rap/Hip-Hop**, and
**Hip Hop/Rap** under **Hip-Hop/Rap**. Matching is case-insensitive and ignores outer whitespace.
**Alternativo** likewise groups under **Alternative**, while **Alternative Rock** remains distinct.
Cards, genre collections, global search, and genre statistics use the same grouping; a song with
multiple equivalent tags counts only once in its genre. Existing genre links still work.

This is a browsing alias, not a tag edit: original metadata stays unchanged in the index and
music files. Unrelated compound genres remain separate. The explicit alias list lives in
`shared/utils/genre.ts`; no rescan is needed for existing libraries.

## Covers

Local covers come from audio metadata. FLAC cover extraction includes a bounded PICTURE-block fallback for files whose picture metadata cannot be handled by the normal decoder path, including malformed MIME metadata. Server covers are fetched through an authenticated main-process proxy. Local artist cards and profiles use indexed album artwork, with a placeholder when none is available. Artist artwork from configured media servers is preserved. There is no public artist-artwork lookup.

A missing cover can still mean there is no embedded picture, the file is damaged, or the server cannot provide it. Include a legally shareable sample or metadata details when reporting extraction errors.

## Storage and safety

The local index and playlists are in SQLite. Queue data is persisted separately in renderer storage. Clearing an index or application data is not the same as deleting your music, but it can remove playlists, preferences, and recorded statistics. Back up the application data before a reset; see [Debugging](troubleshooting/debug.md).
