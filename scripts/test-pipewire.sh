#!/usr/bin/env bash
set -euo pipefail

for tool in dbus-run-session pipewire wireplumber pw-cli pw-cat pw-link pw-metadata cargo; do
  command -v "$tool" >/dev/null || { echo "Missing test dependency: $tool" >&2; exit 1; }
done

# Keep test services separate from the user's desktop audio session.
if [[ "${SPLAYER_TEST_DBUS:-}" != 1 ]]; then
  exec dbus-run-session -- env SPLAYER_TEST_DBUS=1 bash "$0" "$@"
fi

config_source="${PIPEWIRE_TEST_CONFIG_SOURCE:-}"
if [[ -z "$config_source" ]]; then
  pipewire_binary=$(readlink -f "$(command -v pipewire)")
  pkg_prefix=$(pkg-config --variable=prefix libpipewire-0.3 2>/dev/null || true)
  for candidate in "$(dirname "$(dirname "$pipewire_binary")")/share/pipewire" "${pkg_prefix:-/usr}/share/pipewire" /usr/share/pipewire; do
    if [[ -f "$candidate/pipewire.conf" && -f "$candidate/client.conf" ]]; then
      config_source="$candidate"
      break
    fi
  done
fi
if [[ ! -f "$config_source/pipewire.conf" || ! -f "$config_source/client.conf" ]]; then
  echo "PipeWire configuration not found. Set PIPEWIRE_TEST_CONFIG_SOURCE to its share/pipewire directory." >&2
  exit 1
fi

log_root="${SPLAYER_PIPEWIRE_LOG_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/splayer-z/pipewire-tests}"
mkdir -p "$log_root"
test_dir=$(mktemp -d "$log_root/run.XXXXXX")
# Unix socket paths must remain short even when persistent logs have a long path.
runtime_dir=$(mktemp -d /tmp/splayer-pipewire-runtime.XXXXXX)
export XDG_RUNTIME_DIR="$runtime_dir"
export PIPEWIRE_CONFIG_DIR="$test_dir/config"
export PIPEWIRE_REMOTE=pipewire-0
unset PIPEWIRE_PROPS
mkdir -p "$PIPEWIRE_CONFIG_DIR/pipewire.conf.d"
chmod 700 "$XDG_RUNTIME_DIR"

children=()
# Stop all test services, remove transient sockets, and preserve failure diagnostics.
cleanup() {
  for pid in "${children[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  rm -rf "$runtime_dir"
  echo "PipeWire test logs: $test_dir"
}
trap cleanup EXIT
printf 'PipeWire test logs: %s\nPipeWire configuration: %s\n' "$test_dir" "$config_source"

cp "$config_source/pipewire.conf" "$PIPEWIRE_CONFIG_DIR/pipewire.conf"
cp "$config_source/client.conf" "$PIPEWIRE_CONFIG_DIR/client.conf"
if [[ -f "$config_source/client-rt.conf" ]]; then
  cp "$config_source/client-rt.conf" "$PIPEWIRE_CONFIG_DIR/client-rt.conf"
else
  cp "$config_source/client.conf" "$PIPEWIRE_CONFIG_DIR/client-rt.conf"
fi
cat > "$PIPEWIRE_CONFIG_DIR/pipewire.conf.d/99-splayer-test.conf" <<'CONFIG'
context.properties = {
    default.clock.rate = 48000
    default.clock.allowed-rates = [ 44100 48000 88200 96000 176400 192000 352800 ]
    default.clock.quantum = 1024
    default.clock.min-quantum = 64
    default.clock.max-quantum = 8192
}
context.objects = [
    { factory = adapter
      args = {
        factory.name = support.null-audio-sink
        node.name = splayer-test-output
        node.description = SPlayer-Test-Output
        media.class = Audio/Sink
        audio.position = [ FL FR ]
        node.virtual = true
      }
    }
]
CONFIG

pipewire > "$test_dir/pipewire.log" 2>&1 &
children+=("$!")
pipewire --version > "$test_dir/versions.log"
wireplumber --version >> "$test_dir/versions.log"
for _ in {1..50}; do
  [[ -S "$XDG_RUNTIME_DIR/pipewire-0" ]] && break
  sleep 0.1
done
[[ -S "$XDG_RUNTIME_DIR/pipewire-0" ]]
wireplumber > "$test_dir/wireplumber.log" 2>&1 &
children+=("$!")
sleep 2
pw-cli ls Node > "$test_dir/nodes.log"
grep -q splayer-test-output "$test_dir/nodes.log"
pw-metadata -m -n settings > "$test_dir/clock.log" 2>&1 &
children+=("$!")

# Run the same rate matrix with and without a monitor attached.
cargo test -p audio-engine pipewire_real_output_rate_matrix -- --ignored --nocapture --test-threads=1 2>&1 | tee "$test_dir/alone.log"
pw-cat --record --target=splayer-test-output --rate=48000 --channels=2 --format=f32 - > /dev/null 2> "$test_dir/monitor.log" &
children+=("$!")
sleep 0.5
kill -0 "${children[-1]}"
pw-link -l > "$test_dir/monitor-links.log"
grep -q splayer-test-output "$test_dir/monitor-links.log"
cargo test -p audio-engine pipewire_real_output_rate_matrix -- --ignored --nocapture --test-threads=1 2>&1 | tee "$test_dir/monitoring.log"

# Also verify small quanta and explicitly supplied SPA JSON properties.
kill "${children[-1]}"
wait "${children[-1]}" 2>/dev/null || true
unset 'children[-1]'
pw-metadata -n settings 0 clock.force-quantum 256
PIPEWIRE_PROPS='{ node.latency = 256/48000 }' cargo test -p audio-engine pipewire_real_output_rate_matrix -- --ignored --nocapture --test-threads=1 2>&1 | tee "$test_dir/small-quantum.log"
