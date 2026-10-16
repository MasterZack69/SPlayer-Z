# macOS troubleshooting

## Packages and architecture

Use a package from [this fork's Releases](https://github.com/MasterZack69/SPlayer-Z/releases) if one is published for your system. Prefer ARM64 for Apple Silicon; x64 builds may require Rosetta. The current application bundle can retain the upstream name `SPlayer-Next.app`.

## Signing and Gatekeeper

An unsigned or unnotarized package may be blocked. Verify its origin first, then use **System Settings → Privacy & Security → Open Anyway** when appropriate. Do not assume every damaged-app message is harmless; see [Damaged app warnings](/troubleshooting/macos-damaged).

## System media integration

The native `media-ctrl` module supplies macOS Now Playing integration. If Control Center or media keys do not update, restart the app, confirm system media controls are enabled, and check whether another application is capturing the keys or owning the media session.

## Updating and reports

Verify the update origin before installing: current updater defaults still point upstream. Use the fork's releases or build from source to remain on SPlayer-Z. Include macOS version, CPU architecture, installation origin, app commit/version, and redacted logs when reporting a problem. Reinstalling an application bundle should not require deleting your library profile.
