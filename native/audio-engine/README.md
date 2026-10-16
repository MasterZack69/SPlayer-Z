# audio-engine

Rust audio engine exposed to the Electron main process through NAPI-RS. FFmpeg handles decoding, CPAL provides Linux PipeWire/PulseAudio/ALSA output on x86_64 and aarch64.

## Source layout

| Directory                    | Responsibility                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/bindings/player/`       | JavaScript types and bindings split by loading, seeking, devices, events and controls; asynchronous tasks and error conversion |
| `src/player/`                | Playback state, resource ownership, load generations, background tasks and transitions                                         |
| `src/decoder/`               | FFmpeg reads, seeking, resampling, decode/DSP workers, bounded buffers and output supply                                       |
| `src/dsp/`                   | Equalization, loudness normalization, speed/pitch processing, limiting and FFT                                                 |
| `src/output/`                | Device selection, CPAL streams, playback handles, Windows COM threads and PipeWire environment                                 |
| `src/output/wasapi/`         | Exclusive-stream lifetime, device-format negotiation and PCM conversion                                                        |
| `src/output/device_watcher/` | Platform-specific device-change monitoring                                                                                     |
| `src/metadata/`              | Reading and writing tags, artwork and lyrics                                                                                   |
| `src/tests/`                 | Cross-module decoding, real PipeWire output tests and source fixtures                                                          |
| `tests/`                     | Node.js integration tests loading the actual `.node` addon                                                                     |

Module unit tests are included as child modules through `#[cfg(test)]` and `#[path]`, allowing access to private implementation details. Cross-module tests live in `src/tests/`; JavaScript binding integration tests live in `tests/`.

## Build and test

Run from the repository root:

```bash
pnpm --dir native/audio-engine build:debug
cargo test -p audio-engine --lib
cargo fmt -p audio-engine --check
```

The build produces `audio-engine.node` and `index.d.ts`. NAPI-RS generates the declarations; do not maintain them manually. The main process imports types through `@splayer/audio-engine`.

Linux PipeWire integration tests require PipeWire, WirePlumber, D-Bus, Cargo, and the corresponding development/runtime dependencies. The script starts isolated services and a virtual output, discovers the PipeWire configuration directory, and prints a persistent log location:

```bash
bash scripts/test-pipewire.sh
```

Use `PIPEWIRE_TEST_CONFIG_SOURCE` to override the configuration directory and `SPLAYER_PIPEWIRE_LOG_DIR` to override the log parent. See `docs/troubleshooting/nix.md` for Nix and real-time scheduling diagnostics.

The JavaScript integration tests need a built native addon and a usable audio output:

```bash
pnpm --dir native/audio-engine test:integration
```

Tests load `audio-engine.node` from the module directory by default. Set `SPLAYER_AUDIO_ENGINE_MODULE` to an absolute `.node` path to use another build. Temporary WAV files and a local HTTP server supply test audio; no public music service is required.
