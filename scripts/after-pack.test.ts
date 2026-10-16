import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Arch, type AfterPackContext } from "electron-builder";
import afterPack from "./after-pack";

/** Build a minimal Electron Builder context for packaging-hook tests. */
const context = (appOutDir: string, arch: Arch, platform = "linux") =>
  ({ appOutDir, arch, electronPlatformName: platform }) as AfterPackContext;

for (const arch of [Arch.x64, Arch.arm64]) {
  test(`Linux ${Arch[arch]} packaging retains font helpers and only matching native prebuilds`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "splayer-pack-"));
    const root = join(dir, "resources/app.asar.unpacked/node_modules");
    try {
      const fonts = join(root, "font-list/libs");
      const prebuilds = join(root, "better-sqlite3/prebuilds");
      await mkdir(fonts, { recursive: true });
      await mkdir(prebuilds, { recursive: true });
      for (const name of ["linux", "win32", "darwin"]) await mkdir(join(fonts, name));
      for (const name of ["core.js", "standardize.js"]) await writeFile(join(fonts, name), "");
      for (const name of ["linux-x64", "linux-arm64", "win32-x64", "darwin-arm64"])
        await mkdir(join(prebuilds, name));
      await afterPack(context(dir, arch));
      assert.deepEqual((await readdir(fonts)).sort(), ["core.js", "linux", "standardize.js"]);
      assert.deepEqual(await readdir(prebuilds), [`linux-${Arch[arch]}`]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

test("Packaging rejects unsupported hosts and architectures", async () => {
  for (const [arch, platform] of [
    [Arch.x64, "win32"],
    [Arch.arm64, "darwin"],
    [Arch.ia32, "linux"],
    [Arch.armv7l, "linux"],
  ] as const)
    await assert.rejects(
      afterPack(context("/unused", arch, platform)),
      /Only x86_64 and ARM64 Linux/,
    );
});

test("Optional absent dependency directories are harmless", async () => {
  await afterPack(context("/does-not-exist/splayer-pack", Arch.x64));
});
