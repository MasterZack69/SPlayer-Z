# User guide

SPlayer-Z is an offline-first fork of SPlayer-Next. Play files on your device, or connect a media server you own or are authorized to use. Local playback does not require a public music-service account.

## First launch

Setup starts with **Choose your language**, with English selected by default. The selected language applies to the remaining setup and the app. Existing installations keep their saved language preference; change it in **Settings → General**.

Continue through the agreement and remaining setup pages, choose your music folders, and let the library scan finish. Settings skipped during setup can be changed later.

## Home

The greeting is followed by a random selection from your library, up to 50 tracks. Use **Play now** or **Add to queue**. The layout adapts to the available width.

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

Song tables share the same layout, including Genre where applicable. See [Library and metadata](/library), [Search](/search), and [Media servers](/streaming).

## Playback and lyrics

Open **Now Playing** for the full player. Lyrics use AMLL; there is no engine selector. Local sidecar files, embedded lyrics, and lyrics supplied by your configured server are supported. See [Lyrics](/lyrics).

The **Fluid** background starts initializing during player entry rather than first showing a blurred-cover background. Initial rendering still depends on cover decoding and GPU availability.

Open **Queue** from the player controls to inspect or rearrange upcoming tracks. The compact popover and full Now Playing queue share the same order. See [Queue](/queue).

## Settings

Use Settings for appearance, playback, lyrics, shortcuts, services, media sources, local caches, and application information. Optional Last.fm and Discord integration remain under **Services**. Media-server credentials are separate from those integrations.

For installation and build problems, start with [Downloads and installation](/download) or [Debugging](/troubleshooting/debug).
