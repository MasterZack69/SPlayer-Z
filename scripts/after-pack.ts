import { type AfterPackContext, Arch } from "electron-builder";
import { join } from "node:path";
import { readdir, rm } from "node:fs/promises";

/** Remove dependency files that cannot be used by the packaged Linux architecture.
 * @param directory - Optional dependency directory
 * @param keep - Basename predicate for entries retained in the package
 */
const trimDirectory = async (directory: string, keep: (name: string) => boolean): Promise<void> => {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await Promise.all(
    entries
      .filter((entry) => !keep(entry))
      .map((entry) => rm(join(directory, entry), { recursive: true, force: true })),
  );
};

/** Package only Linux x64/ARM64 resources; never bundle other platform prebuilds.
 * @param context - Electron Builder package context
 */
const afterPack = async (context: AfterPackContext): Promise<void> => {
  if (context.electronPlatformName !== "linux" || ![Arch.x64, Arch.arm64].includes(context.arch)) {
    throw new Error("Only x86_64 and ARM64 Linux packages are supported");
  }
  const arch = context.arch === Arch.x64 ? "x64" : "arm64";
  const modules = join(context.appOutDir, "resources/app.asar.unpacked/node_modules");
  await Promise.all([
    trimDirectory(
      join(modules, "better-sqlite3/prebuilds"),
      (name) => name === `linux-${arch}` || name === `linux-${arch}.node`,
    ),
    trimDirectory(
      join(modules, "better-sqlite3/lib"),
      (name) => !/^(?:[^.]+)-(?:x64|arm64)\.js$/.test(name) || name === `linux-${arch}.js`,
    ),
    trimDirectory(
      join(modules, "font-list/libs"),
      (name) => name === "linux" || name.endsWith(".js"),
    ),
  ]);
};
export default afterPack;
