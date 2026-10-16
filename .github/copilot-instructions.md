# SPlayer-Z Copilot Instructions

Use **English** for all Copilot conversations, code reviews, suggestions, new or updated code comments, commit messages, PR titles and descriptions, and project documentation. Application localization strings may remain in their target languages. See `docs/contributing.md` and `AGENTS.md` for repository guidance.

## Project overview

SPlayer-Z is a cut-down fork of SPlayer-Next, a desktop music player based on **Electron + Vue 3 + TypeScript**, with **Rust NAPI-RS** native modules for audio decoding, system media integration, and taskbar integration. This fork focuses on local music and user-owned media servers.

### Process architecture

- **Main process** `electron/main/`: window management, IPC, and native module coordination
- **Preload** `electron/preload/`: exposes `window.api` through contextBridge
- **Renderer** `src/`: Vue 3 SPA; auxiliary window code and shared lyric utilities live under `windows/`. Desktop Lyric and Dynamic Island entrypoints are disabled in this fork.

### Native modules (`native/`)

- `audio-engine`: `ffmpeg_audio` decoding (statically built FFmpeg without system FFmpeg dependencies), rodio playback, FFT, and cover extraction. URLs use `ffmpeg_audio::HttpAudioSource` with `HttpCancelHandle` for interruption and seek resets (`reqwest` + `rustls`), providing a Read+Seek stream to `ffmpeg_audio`.
- `media-ctrl`: cross-platform system media controls (Windows SMTC / Linux MPRIS / macOS MPNowPlaying) and Discord RPC
- `taskbar-lyric`: Windows-only taskbar window embedding with RegistryWatcher, UiaWatcher, and TrayWatcher monitoring

Native modules are loaded lazily through `loadNativeModule()` in `electron/main/utils/nativeLoader.ts`.

### Path aliases

| Alias                    | Target                 | Usage                                                   |
| ------------------------ | ---------------------- | ------------------------------------------------------- |
| `@/*`                    | `src/*`                | Renderer                                                |
| `@shared/*`              | `shared/*`             | Main process, renderer, and native types                |
| `@main/*`                | `electron/main/*`      | Main process                                            |
| `@windows/*`             | `windows/*`            | Auxiliary lyric windows and `windows/shared/` utilities |
| `@splayer/audio-engine`  | `native/audio-engine`  | Main process; import types from generated `index.d.ts`  |
| `@splayer/media-ctrl`    | `native/media-ctrl`    | Same as above                                           |
| `@splayer/taskbar-lyric` | `native/taskbar-lyric` | Same as above                                           |

## Code conventions

- **Language:** English for comments, Git commits, PRs, reviews, and documentation. Use Conventional Commits: `<type>: <English summary>`.
- **Time units:** renderer time values are in **milliseconds**. The Rust engine uses seconds; conversion happens through `toMs()` in `electron/main/ipc/player.ts`.
- **Prettier:** double quotes, semicolons, 100-character width, and trailing commas
- **Auto-imports:** `vue`, `pinia`, `vue-router`, `@vueuse/core`, and `vue-i18n` need no manual imports; UI components are injected from `src/components/`.
- **Native module types:** never hand-write them; import generated `index.d.ts` types from `@splayer/<module>`.
- **Two-layer playback state:** `src/stores/status.ts` provides reactive Pinia state (5 Hz); `src/services/playback.ts` holds the non-reactive time source sampled by RAF for 60 fps lyrics and spectrum rendering.
- **Reactivity:** use `shallowRef` for large collections such as `Track[]`. Persisting reactive proxies to IndexedDB causes `DataCloneError`.
- **Store persistence:** write only lightweight data to sessionStorage. Never persist `TrackDetail`, which contains large lyric strings.
- **IPC listeners:** main-process push events use the preload `subscribe` helper (`ipcRenderer.on` plus a returned per-handler `unsubscribe`). Do not add `removeAllListeners` to individual channels. Finite-lifetime consumers must save and call `unsubscribe` in `onBeforeUnmount` / `onScopeDispose`. Application-level singletons registered once, such as Pinia setup stores, intentionally retain their subscriptions for the process lifetime.
- **Generated files:** do not edit `auto-imports.d.ts`, `components.d.ts`, or `native/*/index.d.ts` manually.
- **Logging:** use scoped loggers from `@main/utils/logger` (`coreLog`, `playerLog`, `mediaLog`, `trayLog`, `taskbarLog`, `nativeLog`, etc.) in the main process. Do not import `electron-log` directly.

## Auxiliary windows (`windows/`)

Existing lyric window code shares:

- `@windows/shared/composables/useNowPlayingSync` for playback sync, lyric indices, and anchor interpolation
- `getNowPlayingCurrentMs()` for non-reactive time reads in word-highlighting RAF loops
- Window-specific lyric selection: `pickPrimaryIndex` accounts for overlap; `pickLatestStartedIndex` switches immediately to the latest started line.

Reuse these shared utilities rather than implementing duplicate synchronization logic. Do not re-enable removed lyric windows as part of unrelated changes.

## Settings schema

- Structure: `src/settings/schema.ts`
- Types: `src/types/settings-schema.ts`, with `SettingCategory` → `SettingSection` → `SettingItem`
- `SettingSection.tag` / `SettingItem.tag` support `SettingTag = { text: string; type?: "primary" | "warning" | ... }` for title badges such as Beta or Experimental.
- i18n keys: `settings.section.{id}`, `settings.{itemKey}.label`, and `settings.{itemKey}.description`
- UI primitives: `STag`, `SButton`, `SSelect`, `SSlider`, `SSwitch`, `SColor`, `SDialog`, etc., using seven theme tokens: default, primary, cover, info, success, warning, and error.
