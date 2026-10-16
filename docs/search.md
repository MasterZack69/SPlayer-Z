# Search

## Global search from Home

The top search field on **Home** opens a dedicated search results page. It searches your indexed local library, local playlists and folders, and the active media server's synchronized library. It does not query public music catalogs or every configured server at once.

Results are grouped into **Songs**, **Albums**, **Artists**, **Genres**, **Playlists**, and **Folders**. **All** shows previews from the available categories; select a category or **Show all** to inspect its results. A newly added server must finish synchronization before its complete library can appear.

Clearing the field with **X** clears the query and its results. Search remains separate from Home rather than injecting a song list into the greeting area.

## Page-scoped search

On Library, Artists, Albums, Genres, Folders, Liked Songs, and collection pages, the top field filters that page's relevant content. For example, an albums page filters albums, while an album detail page filters its songs. It does not replace the current page with global results.

The extra local Library search bar has been removed. Clear the top field to restore the unfiltered page. Page filters are represented by the route's `filter` query value, so navigation and the field stay synchronized.

## Search playback behavior

**Settings → Player → Search Playback Behavior** controls what double-clicking a song in search results puts into the playback queue:

- **Play Current Track Only** starts that one result.
- **Play All Results** uses the matching song results as the playback list, starting at the selected song.

This setting concerns playback, not which categories search returns.

## Troubleshooting

Wait for local scanning or server synchronization to finish. Check that the intended media server is active. If a server is offline, its synchronized metadata may still be searchable even though an uncached track cannot play. Report the current page, query, expected category, and whether the missing item is local or server-backed.
