import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Read a tracked source relative to this test, independent of the working directory.
 * @param path - Repository-relative source path.
 * @returns Source contents.
 */
const source = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const appId = "io.github.MasterZack69.SPlayerZ";
const repository = "https://github.com/MasterZack69/SPlayer-Z";

test("package, Linux desktop, executable, and Nix identities agree", () => {
  const pkg = JSON.parse(source("package.json"));
  assert.equal(pkg.name, "splayer-z");
  assert.equal(pkg.productName, "SPlayer-Z");
  assert.equal(pkg.desktopName, appId);
  assert.equal(pkg.repository.url, repository);
  assert.equal(pkg.homepage, repository);
  assert.equal(pkg.bugs.url, `${repository}/issues`);
  const builder = source("electron-builder.config.ts");
  assert.ok(builder.includes(`appId: "${appId}"`));
  assert.ok(builder.includes('executableName: "splayer-z"'));
  const flake = source("flake.nix");
  for (const text of [
    'pname = "splayer-z"',
    "$out/bin/splayer-z",
    "$out/share/splayer-z/resources",
    `name = "${appId}"`,
    `startupWMClass = "${appId}"`,
  ]) {
    assert.ok(flake.includes(text), text);
  }
  const mpris = source("native/media-ctrl/src/sys_media/linux.rs");
  assert.ok(mpris.includes('.identity("SPlayer-Z")'));
  assert.ok(mpris.includes(`.desktop_entry("${appId}")`));
});

test("release packaging retains the fork identity without an in-app updater", () => {
  const builder = source("electron-builder.config.ts");
  assert.ok(builder.includes('owner: "MasterZack69"'));
  assert.ok(builder.includes('repo: "SPlayer-Z"'));
  assert.doesNotMatch(source("electron/main/core/index.ts"), /initUpdater/);
});

test("renderer storage uses its own SPlayer-Z namespace", () => {
  for (const store of ["library", "queue", "history", "playlist", "user", "data"]) {
    assert.ok(source(`src/stores/${store}.ts`).includes('name: "splayer-z"'), store);
  }
  assert.ok(
    source("src/components/settings/custom/StorageManager.vue").includes('name: "splayer-z"'),
  );
  const entry = source("electron/main/index.ts");
  assert.ok(entry.indexOf('import "./utils/appIdentity"') < entry.indexOf("import { initApp }"));
});
