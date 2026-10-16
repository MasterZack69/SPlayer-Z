# Media servers

SPlayer-Z can play your local library without network access and can optionally connect to servers you own or are authorized to access. Configure them in **Settings → Media Sources**.

## Supported server families

| Server                                                  | Adapter             |
| ------------------------------------------------------- | ------------------- |
| Subsonic, Navidrome, OpenSubsonic, Airsonic, Gonic, LMS | Subsonic-compatible |
| Jellyfin                                                | Jellyfin            |
| Emby                                                    | Emby                |

Compatibility depends on the server version, enabled APIs, and account permissions. These are personal media-server connections, not public KG/QM music-platform logins.

## Connect and synchronize

1. Enable media sources if disabled.
2. Add the server type, address, and account credentials.
3. Test the connection, then connect and choose the active server.
4. Let synchronization finish before expecting the full library in browse pages and global search.

Songs, albums, artists, and playlists are synchronized into a local SQLite snapshot. A failed or interrupted synchronization preserves the previous completed snapshot instead of publishing a partial library. The renderer reads that snapshot rather than making direct authenticated server requests.

## Playback and identity

The main process resolves authenticated playback and cover requests. Server-backed tracks retain their originating server ID; identical track IDs from different servers are not interchangeable. Credentials and session tokens must not be embedded in renderer-visible cover URLs.

Changing a server's media identity invalidates the corresponding media revision used by playback, caches, and completed downloads. Renaming a server does not change that identity or interrupt playback.

Server favorites use the server's returned state. Listening reports are driven by actual playback: Jellyfin/Emby sessions and Subsonic now-playing/scrobble reports are not generated merely by preloading or downloading a file.

## Caching and downloads

Song caching is controlled under **Settings → Local & Cache**. Server-backed caching and authorized original-file downloads remain available where supported by the server and account. The removed public-catalog Downloads page is not required for these operations.

Cached metadata is not cached audio. A synchronized song still needs the server unless its audio is available locally. Server permissions, original-file endpoints, and authentication can affect downloads independently of playback.

## Security and diagnostics

Prefer HTTPS, particularly outside a trusted local network. Passwords are stored using Electron `safeStorage` when available. If it is unavailable, streaming credentials fall back to Base64 and a local warning is logged. Base64 is not encryption; protect and back up the application data accordingly.

For failures, check the URL, certificate, credentials, server permissions, synchronization state, and active server. Share redacted logs and server versions, never passwords or access tokens.
