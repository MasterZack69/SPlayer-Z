# Native modules

SPlayer-Z uses Rust and NAPI-RS for decoding, output, metadata, and operating-system integration. Native modules are loaded in the Electron main process through `electron/main/utils/nativeLoader.ts`.

## Active build targets

`scripts/build-native.ts` builds:

| Module              | Responsibility                                                 | Platforms               |
| ------------------- | -------------------------------------------------------------- | ----------------------- |
| `audio-engine`      | FFmpeg decoding, CPAL output, DSP, metadata, covers and lyrics | Current desktop targets |
| `media-ctrl`        | System media controls and Discord integration                  | Current desktop targets |
| `opencc`            | Text conversion used by lyric settings                         | Current desktop targets |
| `taskbar-lyric`     | Taskbar lyric integration                                      | Windows only            |
| `taskbar-thumbnail` | Taskbar thumbnail integration                                  | Windows only            |

An old module directory or declaration is not proof that a feature is still built. In particular, audio capture for recognition is not part of the active native build list. Do not re-enable removed subsystems to satisfy a stale reference.

## Audio architecture

`audio-engine` decodes through `ffmpeg_audio` and outputs through **CPAL**, with Linux PipeWire/PulseAudio support. Windows exclusive output uses WASAPI directly. DSP includes equalization, normalization, speed/pitch processing, limiting, and FFT.

Loading and cancellation use generation ownership so a late decoder result cannot replace a newer track. Streaming HTTP sources and authentication resolution must preserve cancellation and avoid exposing credentials to the renderer.

JavaScript-facing times are milliseconds. Rust works in seconds internally; conversion occurs at the main-process boundary.

## Build prerequisites

Use the Node and pnpm versions required by `package.json`, a Rust toolchain with Cargo, the platform C/C++ toolchain, and Python for native Node dependencies. Linux builds also require development packages for the selected audio backends and system libraries.

Do not assume there are zero system dependencies. The Nix flake uses `FFMPEG_MODE=system`, with FFmpeg, PipeWire, PulseAudio, ALSA, OpenSSL, D-Bus, and `pkg-config` declared in the derivation. Other FFmpeg build modes depend on `ffmpeg_audio` configuration. See [Nix diagnostics](/troubleshooting/nix).

```bash
pnpm build:native --dev
pnpm build:native
cargo check --all-targets --locked
cargo test --locked
```

`--all-targets` checks Cargo targets for the current host; it does not require testing Windows from a Linux host. Windows-specific dependencies must remain target-gated.

## Generated declarations

NAPI-RS generates `native/*/index.d.ts`. Import those declarations through the `@splayer/*` aliases; do not hand-write or manually edit them. Rebuild the relevant module when its bindings change.

`SKIP_NATIVE_BUILD=true` skips the native build step, but does not supply a working addon. Use it only when suitable native outputs already exist or for renderer-only work that does not load them.

## Audio-engine tests

From the repository root:

```bash
cargo test -p audio-engine --lib
cargo fmt -p audio-engine --check
pnpm --dir native/audio-engine build:debug
pnpm --dir native/audio-engine test:integration
bash scripts/test-pipewire.sh
```

The Node integration suite needs a built `.node` module and a usable audio output. Real PipeWire tests need their own runtime dependencies and are distinct from normal unit tests. The module's `native/audio-engine/README.md` describes its source layout and test fixtures.
