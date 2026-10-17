import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * Read a source relative to this test, independent of the working directory.
 * @param path - Repository-relative source path.
 * @returns File contents.
 */
const source = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Discord RPC has no native worker, dependency, exports, or configuration", () => {
  assert.equal(existsSync(new URL("../native/media-ctrl/src/discord.rs", import.meta.url)), false);
  for (const path of [
    "native/media-ctrl/Cargo.toml",
    "native/media-ctrl/src/lib.rs",
    "native/media-ctrl/src/model.rs",
    "native/media-ctrl/index.d.ts",
    "electron/main/services/media.ts",
    "electron/main/ipc/config.ts",
    "shared/types/settings.ts",
    "shared/defaults/settings.ts",
    "src/settings/categories/services.ts",
    "src/i18n/locales/en-US.json",
    "src/i18n/locales/zh-CN.json",
  ])
    assert.doesNotMatch(source(path), /discord|rich.presence/i, path);
  assert.doesNotMatch(source("Cargo.lock"), /name = "discord-rich-presence"/);
});

test("MPRIS controls, metadata, artwork, and Last.fm remain supported", () => {
  const native = source("native/media-ctrl/src/lib.rs");
  for (const api of [
    "initialize",
    "enable",
    "disable",
    "on_event",
    "set_metadata",
    "set_play_state",
    "set_timeline",
    "shutdown",
  ])
    assert.ok(native.includes(`pub fn ${api}(`), api);
  const linux = source("native/media-ctrl/src/sys_media/linux.rs");
  assert.match(linux, /payload\.cover_data/);
  assert.match(linux, /payload\.cover_url/);
  assert.match(linux, /\.artist\(payload\.artists\)/);
  assert.match(source("src/settings/categories/services.ts"), /lastfmScrobble/);
});
