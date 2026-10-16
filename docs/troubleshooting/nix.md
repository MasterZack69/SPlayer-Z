# Nix and PipeWire diagnostics

## Build and development shell

From the repository root:

```bash
nix build .
./result/bin/splayer-z
nix develop
```

The flake declares native build tools and libraries inside the derivation. Having `pkg-config` installed on the host does not make libraries visible inside a sandboxed Nix build. `libdbus-sys` needs the D-Bus development metadata (`dbus-1.pc`) as well as `pkg-config`; the flake includes both.

The package uses system FFmpeg through `FFMPEG_MODE=system`. Linux audio dependencies include PipeWire, PulseAudio, and ALSA. The development shell supplies Cargo/Rust and library paths; it does not replace a working desktop audio service.

For the native host checks:

```bash
nix build .#checks.x86_64-linux.cargo-check
nix build .#checks.x86_64-linux.cargo-test
```

Replace `x86_64-linux` with `aarch64-linux` on ARM64 Linux. These checks run natively on the matching host. A dirty Git tree warning is not itself a compiler failure; inspect the full derivation log and ensure new source files are tracked.

## Real PipeWire output tests

Run the script in an environment containing Cargo, PipeWire, WirePlumber, D-Bus tools, and the PipeWire command-line utilities:

```bash
set -o pipefail
bash scripts/test-pipewire.sh 2>&1 | tee "$HOME/splayer-pipewire-test.log"
```

The script starts an isolated D-Bus session and test PipeWire/WirePlumber services. It does not reuse your desktop audio session. The real-output tests exercise multiple sample rates and a monitor-client case; they are distinct from ordinary Cargo unit tests.

If a dependency is missing, install it or enter an environment that provides it. The script requires `dbus-run-session`, `pipewire`, `wireplumber`, `pw-cli`, `pw-cat`, `pw-link`, `pw-metadata`, and `cargo`.

## Configuration discovery

The script searches the PipeWire executable prefix, the `libpipewire-0.3` pkg-config prefix, and `/usr/share/pipewire`. Nix installations do not necessarily use `/usr/share`.

If discovery fails, point it at a directory containing `pipewire.conf` and `client.conf`:

```bash
PIPEWIRE_TEST_CONFIG_SOURCE=/path/to/share/pipewire bash scripts/test-pipewire.sh
```

`client-rt.conf` is used when present; otherwise the script uses `client.conf` for that test configuration. Do not point the variable at one file.

## Persistent logs

Read the exact **PipeWire test logs:** path printed by the run. Logs are preserved under `${XDG_STATE_HOME:-$HOME/.local/state}/splayer-z/pipewire-tests/run.*` by default. Override the parent with `SPLAYER_PIPEWIRE_LOG_DIR`. Temporary runtime sockets are removed on exit, not the diagnostic logs.

```bash
log_dir=/path/printed/by/the/test
cat "$log_dir/versions.log"
cat "$log_dir/clock.log"
tail -n 60 "$log_dir/pipewire.log" "$log_dir/wireplumber.log"
```

Also attach the test output and node/monitor logs when available. Do not reuse a vanished `/tmp/splayer-pipewire.*` path from an older script version.

## RealtimeKit and D-Bus

Linux real-time thread promotion can use D-Bus to contact `org.freedesktop.RealtimeKit1`. If that service is absent, the engine logs a warning and keeps the current output stream without real-time priority. This is separate from build-time D-Bus headers and does not, by itself, prove a sample-rate or playback-speed bug.

A failing rate test needs its elapsed-time result, negotiated output format, clock state, and server logs. Do not suppress timing assertions just to make a test pass. Use the distribution's supported real-time scheduling configuration if appropriate; do not grant broad privileges to the player as a workaround.
