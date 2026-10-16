# SPlayer-Z Copilot instructions

Read `AGENTS.md` before changing the repository. It is the authoritative contributor and agent guide; `docs/architecture.md`, `docs/native.md`, and `docs/contributing.md` explain the current architecture and workflow.

## Language and scope

Use **English** for conversations, reviews, suggestions, new or updated code comments, commits, pull requests, documentation, and contributor instructions. Localized application strings remain in their target languages. Use a one-line English Conventional Commit subject without a body unless requested.

Target **dev**. Preserve the root **README.md** unless explicitly authorized. Keep changes focused and do not put personal task commentary in public documentation.

## Current product boundaries

The app is local-first with authorized Subsonic-compatible, Jellyfin, and Emby servers. Use the shared SongList, categorized global/contextual search, Home statistics, AMLL lyrics, and shared draggable queue. Do not reactivate retired platform logins, public catalogs, plugins, external control services, lyric lookup, or auxiliary lyric windows to resolve stale references.

The audio engine uses FFmpeg and **CPAL**, not rodio. Nix uses system FFmpeg and explicit audio/D-Bus dependencies. Windows-specific integration still exists and must remain target-gated; Linux changes do not require Windows testing.

## Implementation safeguards

- Keep authentication and server playback resolution in the main process; never expose secrets in renderer URLs or logs.
- Preserve queue-entry identity for duplicate songs, current-track continuity, persistence, and keyboard accessibility.
- Preserve lyric timing and text offsets; never interpret arbitrary lyric markup as executable HTML.
- Use generated native types, shared cross-process contracts, lightweight persisted data, and shallow track collections.
- Event subscriptions return per-handler cleanup functions. Finite-lifetime consumers unsubscribe; do not add bulk `removeAllListeners` calls to shared channels.
- Bound caches, stop hidden animation work, and follow AGENTS memory-measurement requirements for rendering/caching/IPC changes.
- Do not edit generated declarations or auto-import files by hand. Format changed files and run relevant checks; report environment limitations honestly.
