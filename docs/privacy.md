# SPlayer-Z Privacy Policy

**Version: v1.2**

**Effective: August 5, 2026**

**Last updated: August 12, 2026**

This policy explains how SPlayer-Z processes, stores, and protects information when you install and use the application. By using the software, you acknowledge this policy.

## 1. Principles

1. **Data minimization:** Only data needed to provide features, protect the application, and preserve your settings is processed.
2. **Local first:** Library metadata, playback history, and preferences remain on your device by default.
3. **Transparency and control:** Local data and optional integrations remain under your control.

## 2. Information processed

### 2.1 Information you provide

- **Third-party credentials:** Server URLs, usernames, passwords, tokens, or API keys entered for services such as Subsonic, Navidrome, Jellyfin, Emby, or Last.fm. Credentials are encrypted locally through the operating system's secure storage when available. If it is unavailable, streaming passwords and Last.fm session keys fall back to Base64 storage and the application writes a warning to the local log. Base64 is not encryption. Credentials are not sent to a server controlled by the developers.
- **Preferences:** Language, theme, shortcuts, audio output, and other settings.

### 2.2 Local runtime and cache data

- Selected music folders, audio metadata, local playlists, lyric caches, and cover thumbnails.
- Audio from streaming servers is not saved into a persistent song cache. Artwork, lyric, and library-index caches are separate.
- Local diagnostic logs. They are not uploaded automatically; you must explicitly provide them when requesting support.

## 3. Purpose

The software processes this information to play and organize media, restore your configuration, and maintain local security and stability. It does not use your data for advertising, profiling, or marketing, and does not sell or rent it.

## 4. Network services

1. **Self-hosted media servers:** Traffic is sent directly from your client to the configured server. You and the server operator are responsible for its security and privacy.
2. **Last.fm:** When enabled, the app communicates with the official Last.fm API. Its own terms and privacy policy apply.
3. **Releases:** The app does not check for updates or automatically contact a release feed. Opening a release or profile link in your browser contacts that website.
4. **Lyrics:** Local files and embedded lyrics stay local; lyrics supplied by your media server are requested from that server, not from a public lyric-search provider.
5. **Artist artwork:** Local artist views use artwork from your music files. Server artwork comes from the configured media server. Artist names are not sent to public artist-artwork services.

## 5. Storage, retention, and protection

Most data remains in the application's local data directory until you clear it or remove the application data. Sensitive credentials prefer operating-system secure storage. Base64 fallback for streaming and Last.fm is explicitly logged. Network features prefer HTTPS/TLS when the destination supports it.

No system can guarantee absolute security. Protect your device and third-party accounts accordingly.

## 6. Your controls

You can inspect local databases and configuration, update preferences and server connections, clear selected caches, or delete the entire application data directory. Uninstalling the executable may not remove the data directory automatically.

## 7. Children

SPlayer-Z is a general-purpose tool and is not designed to collect information from children. Minors should review this policy and use the software with a guardian.

## 8. Policy updates

Updates are published on the official documentation site and may also be mentioned in release notes or in the application. The date above indicates when the latest revision takes effect.

## 9. Contact

- [GitHub Issues](https://github.com/MasterZack69/SPlayer-Z/issues)
- [SPlayer-Z source repository](https://github.com/MasterZack69/SPlayer-Z)
