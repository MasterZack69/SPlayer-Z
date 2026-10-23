# SPlayer-Z

A cut-down fork of SPlayer-Next primarily focused on local music and user-owned media servers, but also has some minor additions such as Genre and Year metadata support.

## Supported music sources

- Local Audio Files
- Subsonic-compatible servers, including Navidrome, OpenSubsonic, Airsonic, Gonic, and LMS
- Jellyfin and Emby servers

## Supported lyric formats
Same as upstream: LRC, eLRC, KRC, QRC, TTML

## Images
<img width="1920" height="1080" alt="Screenshot From 2026-10-17 17-08-58" src="https://github.com/user-attachments/assets/af9a264b-3ec5-477b-887b-5d0bf44d76e7" />
<img width="1920" height="1080" alt="Screenshot From 2026-10-17 17-09-31" src="https://github.com/user-attachments/assets/6f81b209-e8bd-4cc3-b430-e75a2fc6dc27" />

## Removed app features

- Public online music playback and discovery (NetEase, QQ Music, and Kugou)
- Public-platform accounts, My Cloud, online playlists, daily picks, heart mode, and Personal FM
- Playback History and Favorites sidebar shortcuts (local history/statistics and local liked songs remain)
- Home discovery sections
- Desktop/Dynamic Island lyric controls
- Discord RPC and NCM Scrobble
- Online lyric matching and AMLL TTML network fetching
- Plugin initialization, plugin playback/lyric/cover fallbacks, and plugin settings
- Download UI/service startup, music recognition, external API servers, and AI/MCP integration
- Windows and MacOS compatibility

## Contributing

See the [contribution guide](docs/en/contributing.md) for setup and contribution requirements. All future commit messages, pull request titles and descriptions, reviews, and new or updated documentation must be in English. Application localization strings may remain in their target languages.

## Credits
SPlayer-Z couldn't be possible without SPlayer-Next, and that could not be possible without the various people who contribute to it. Special thanks to imsyy, MoYingJi, Kyv001, PhantomPixel and a dozen other cool and awesome people!
