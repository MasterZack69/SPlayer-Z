# Debugging and logs

## Collect useful evidence

Include the SPlayer-Z commit or version, OS and architecture, installation format, reproduction steps, expected behavior, and complete relevant error output. For server issues, add the server type/version and whether synchronization completed. Redact credentials, tokens, personal paths, and private server addresses as needed.

Use the app's **Open log directory** control in Settings → About rather than guessing a path. Application logs live under `{userData}/app-data/logs/`; native logs are under its `native/` subdirectory. Current builds can retain the upstream `SPlayer-Next` data-directory name.

Typical user-data roots are `%APPDATA%/SPlayer-Next` on Windows, `~/Library/Application Support/SPlayer-Next` on macOS, and `${XDG_CONFIG_HOME:-$HOME/.config}/SPlayer-Next` on Linux. Portable Windows builds use `UserData` beside the executable. Check the actual build and path before moving files.

## Developer tools

Use the Developer Tools command when available. In development, the common shortcuts are Ctrl+Shift+I on Windows/Linux and Cmd+Option+I on macOS. Console shows renderer errors; Network helps diagnose failed media-server requests. Main-process and Rust errors may only appear in application logs or the terminal.

## Common checks

- **Silence or wrong speed:** Check the selected output device, audio backend, negotiated rate, and [PipeWire diagnostics](/troubleshooting/nix).
- **Missing cover:** Check embedded artwork or server access; a placeholder is not proof of a network error.
- **Missing lyrics:** Check sidecar filenames, embedded text, and server-provided lyrics. There is no public lyric-fetch fallback.
- **Missing search item:** Finish scanning/synchronization and verify the active server and page scope.
- **Stale IPC errors:** Rebuild main and renderer together; a new renderer paired with old main output can request a handler that is not registered. Do not re-enable removed API services to hide the error.

## Reset safely

Back up the entire user-data directory before resetting. Close the app, rename that directory, and start again to create a fresh profile. This can remove settings, credentials, playlists, queue state, library indexes, and statistics from the active profile. Uninstalling the executable may leave user data behind.

Do not delete your music folders as a troubleshooting step. Prefer targeted cache controls in **Settings → Local & Cache** when the problem is limited to cached data.
