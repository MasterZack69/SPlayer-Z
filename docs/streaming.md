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

Changing a server's media identity invalidates the corresponding media revision used by playback and completed downloads. Renaming a server does not change that identity or interrupt playback.

Server favorites use the server's returned state. Listening reports are driven by actual playback: Jellyfin/Emby sessions and Subsonic now-playing/scrobble reports are not generated merely by preloading or downloading a file.

## Caching and downloads

Song caching is controlled under **Settings → Local & Cache**. Server-backed caching and authorized original-file downloads remain available where supported by the server and account. The removed public-catalog Downloads page is not required for these operations.

Synchronized metadata is not cached audio. Streaming playback does not save tracks into a persistent song cache and requires the server to remain accessible. Local-file PCM preloading/crossfade does not download server tracks. Server permissions, original-file endpoints, and authentication can affect downloads independently of playback.

## Security and diagnostics

Prefer HTTPS, particularly outside a trusted local network. Media-server passwords require Electron `safeStorage` backed by a real desktop keyring. The `basic_text` backend is rejected even if Electron reports encryption as available; there is no plaintext or Base64 fallback. Protect and back up the application data and keyring accordingly.

If credential storage fails, unlock the keyring and restart SPlayer-Z in the same desktop session. A running keyring daemon alone does not guarantee that Electron can access it; check the desktop session’s Secret Service/keyring integration if Electron still selects `basic_text`. A successful connection test with a newly entered password does not guarantee that the keyring can save it.

Older unprefixed Linux keyring ciphertext (`v11`) is decrypted and rewritten as `safe:v1:` on successful access. Old Base64 plaintext fallback, unsupported formats and damaged records require re-entering the password under **Settings → Media Sources**. They are never sent to the server as guessed passwords. Failed decryption or saving leaves the stored credentials intact. A failed format rewrite does not block playback with successfully decrypted credentials. Credential-storage errors are distinct from server authentication failures.

For failures, check the URL, certificate, credentials, server permissions, synchronization state, and active server. Share redacted logs and server versions, never passwords or access tokens.
