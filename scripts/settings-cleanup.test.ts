import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

/** Read tracked source text for feature-boundary regression checks.
 * @param path - Repository-relative file path.
 * @returns Source file contents.
 */
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("retired proxy, updater, song-cache, and public artist-artwork services stay removed", () => {
  for (const path of [
    "electron/main/apis/musicbrainz.ts",
    "electron/main/utils/proxy.ts",
    "electron/main/services/songCache.ts",
    "electron/main/database/songCache.ts",
    "electron/main/services/updater.ts",
    "electron/main/ipc/update.ts",
    "src/stores/update.ts",
    "src/components/modals/UpdateDialog.vue",
    "src/services/cacheScheduler.ts",
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);
  }
  assert.doesNotMatch(read("electron/main/core/index.ts"), /initSongCache|initUpdater/);
  assert.doesNotMatch(
    read("electron/preload/index.ts"),
    /testNetworkProxy|update:check|song:fetch/,
  );
  assert.doesNotMatch(read("src/settings/categories/services.ts"), /networkProxy/);
  assert.doesNotMatch(read("src/settings/categories/localCache.ts"), /songCache|cacheStreaming/);
  for (const path of [
    "electron/main/ipc/library.ts",
    "electron/preload/index.ts",
    "shared/types/library.ts",
    "src/services/artistLoader.ts",
    "src/stores/library.ts",
  ]) {
    assert.doesNotMatch(read(path), /fetchArtistAvatar|prefetchArtistAvatars|loadArtistAvatars/);
  }
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["electron-updater"], undefined);
});
