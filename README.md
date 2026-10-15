# SPlayer-Z

A cut-down fork of SPlayer-Next focused on local music and user-owned media servers.

## Supported music sources

- Local audio files, folders, playlists, albums, artists, and genres
- Subsonic-compatible servers, including Navidrome, OpenSubsonic, Airsonic, Gonic, and LMS
- Jellyfin and Emby servers
- Embedded lyrics, local sidecar lyric files, local TTML repositories, and lyrics returned by the configured media server

## Removed app features

- Public online music playback and discovery (NetEase, QQ Music, and Kugou)
- Public-platform accounts, My Cloud, online playlists, daily picks, heart mode, and Personal FM
- Playback History and Favorites sidebar shortcuts (local history/statistics and local liked songs remain)
- Home discovery sections, On Repeat, and quick actions
- Desktop/Dynamic Island lyric controls and automatic window restoration
- Online lyric matching and AMLL TTML network fetching
- Plugin initialization, plugin playback/lyric/cover fallbacks, and plugin settings
- Download UI/service startup, music recognition, external API servers, and AI/MCP integration

Local playback and media-server streaming do not require a public music account. Media-server streaming requires access to the user's configured server. Optional Last.fm, Discord, and app updates are retained.

## Development

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```

`SKIP_NATIVE_BUILD=true` skips native builds when prebuilt native modules are available. `pnpm exec electron-vite build` validates the JavaScript bundles without compiling Rust or packaging the desktop app.
