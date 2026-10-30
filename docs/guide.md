# User guide

SPlayer-Z is an offline-first Linux music player. Play files on your device, or connect a media server you own or are authorized to use. Local playback does not require a public music-service account.

## First launch

Setup starts with **Choose your language**, with English selected by default. The selected language applies to the remaining setup and the app. Existing installations keep their saved language preference; change it in **Settings → General**.

Continue through the agreement and remaining setup pages, choose your music folders, and let the library scan finish. Settings skipped during setup can be changed later.

## Home

The greeting is followed by a random selection from your library, up to 50 tracks. **Play now** replaces the queue with that selection, starting with the featured song at the top. **Add to queue** inserts the same featured-first order after the current song. The layout adapts to the available width.

The **Stats** section below the selection contains:

- Song, album, artist, and genre counts, total duration, and library size.
- Listening activity and listening hours.
- Audio-format distribution.
- Most-played songs, albums, and artists.

These are local library and playback statistics, not online recommendations. Empty charts can mean that no qualifying listening events have been recorded yet. There is no separate Stats destination; older `/stats` links open Home.

## Organize and find music

- **Library** shows indexed local songs.
- **Artists**, **Albums**, **Genres**, and **Folders** offer different views of that library.
- **Liked Songs** holds locally liked tracks; personal playlists remain available.
- **Media Sources** manages your own servers.

Song tables share the same layout, including Genre where applicable. See [Library and metadata](library.md), [Search](search.md), and [Media servers](streaming.md).

## Playback and lyrics

With only one song in the queue, **Previous** returns to the beginning without changing whether playback is paused. **Next** leaves playback unchanged and displays a notice that there are no other tracks.

Open **Now Playing** for the full player. Lyrics use AMLL; there is no engine selector. Local sidecar files, embedded lyrics, and lyrics supplied by your configured server are supported. See [Lyrics](lyrics.md).

The **Fluid** background starts initializing during player entry rather than first showing a blurred-cover background. Initial rendering still depends on cover decoding and GPU availability.

Open **Queue** from the player controls to inspect or rearrange upcoming tracks. The compact popover and full Now Playing queue share the same order. See [Queue](queue.md).

## Settings

Use Settings for appearance, playback, lyrics, shortcuts, services, media sources, local caches, and application information. Settings search includes nested controls and translated descriptions; selecting a result highlights that control, or its nearest visible parent if collapsed. Optional Last.fm integration remains under **Services**. Media-server credentials are separate from those integrations.

Under **Appearance → Transitions & Animations**, enable **Reduce Motion** for lighter interface effects. The system's reduced-motion preference is also honored, including when the app switch is off. Queue dragging still follows the pointer, but skips animated settling.

**Shared Element Transitions** is off by default. Enable it to animate artwork between a card and its artist/collection detail page, and between the player bar and Now Playing. Reduced motion disables these shared transitions. Unavailable browser support or unloaded artwork falls back to ordinary navigation. Fluid backgrounds continue initializing during player entry.

For installation and build problems, start with [Downloads and installation](download.md) or [Debugging](troubleshooting/debug.md).

## Playback and application information

Enable **Settings → Player → Keep Screen Awake During Playback** to prevent display sleep while music is playing. It is on by default. When disabled, the app never blocks screen sleep or automatic system suspension, including during playback. When enabled, sleep inhibitors are held only for active playback, not while loading or idle, and are released on pause, stop, completion, playback failure, player reset, or exit. The desktop environment controls whether inhibitors are honored.

Local PCM preloading and crossfade remain available without a song cache. Streaming tracks play directly from your server; they are not downloaded into an automatic song cache. Only cover-thumbnail and background caches are managed under **Local & Cache**.

About identifies MasterZack69 as maintainer and acknowledges upstream SPlayer-Next contributors. Application updates are installed manually, not checked for in the background.

## Song-list columns

Open **Appearance → Song List Columns → Configure** to hide or reorder the built-in
columns. Drag a handle, or focus it and use the up/down arrow keys. Title remains
visible. Confirm saves the layout across song lists and app restarts; Cancel discards
changes. Reset restores the default order and visibility in the editor until confirmed.
Pages may still omit columns that do not apply to their content. There are no custom columns.

Sidebar and column configuration use lifted drag previews that follow the pointer,
slide neighbouring rows aside, and settle into the drop position. Press Escape to
cancel a drag without closing the editor. Sidebar handles also support up/down arrow
keys for reordering groups, navigation entries, and playlists.

## Song-list density

Choose **Appearance → Song List Style → Compact** for smaller song rows and covers.
Comfortable remains the default. Both styles keep the same columns, sorting, year links,
and playback actions. Narrow windows automatically collapse the sidebar and simplify
the player bar without changing your saved sidebar preference. During track transitions,
the seek bar glows briefly to indicate that playback is switching tracks.

### Multi-disc albums

Albums containing more than one disc are grouped by disc number in the default song-list
order. Each section shows its disc number, optional subtitle, and full disc track count.
Tagged track numbers are retained when searching within an album. Choosing another sort
field displays one continuous sorted list instead.

Local disc metadata is read from common disc-number tags, including `DISCNUMBER`, `disc`,
and ID3 `TPOS`; values such as `2/3` use the first number. Disc subtitles use `DISCSUBTITLE`
or ID3 `TSST`. Files without a disc number belong to disc 1. Existing libraries receive a
one-time metadata refresh during scanning. Jellyfin, Emby and Subsonic disc numbers are
also supported; OpenSubsonic disc subtitles are shown when supplied by the server.

The volume slider uses a decibel-based curve with a gradual taper to silence at the bottom.
Saved actual volume is preserved across upgrades, though its displayed percentage may change.
