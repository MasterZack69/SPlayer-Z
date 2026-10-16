import { spawnSync } from "node:child_process";
import process from "node:process";

import { assertSupportedPlatform } from "../shared/utils/platform";

assertSupportedPlatform();
const modules = ["audio-engine", "media-ctrl", "opencc"];

/** Check the compiler before invoking NAPI builds. */
const isRustAvailable = () => {
  const result = spawnSync("cargo", ["--version"], {
    stdio: "ignore",
  });

  return !result.error && !result.signal && result.status === 0;
};

if (process.env.SKIP_NATIVE_BUILD === "true" || process.env.SKIP_NATIVE_BUILD === "1") {
  console.log("[BuildNative] SKIP_NATIVE_BUILD is set; skipping native builds");
  process.exit(0);
}

if (!isRustAvailable()) {
  console.error("[BuildNative] Rust toolchain not found");
  console.error("[BuildNative] Rust is required unless SKIP_NATIVE_BUILD=true");
  console.error(
    "[BuildNative] Install Rust from https://rust-lang.org/tools/install/ or set SKIP_NATIVE_BUILD=true",
  );
  process.exit(1);
}

/** Parse development mode and optional NAPI compiler arguments. */
const parseArgs = () => {
  const options: {
    isDev: boolean;
    passing?: string[];
  } = {
    isDev: false,
  };

  const argv = process.argv;
  let index = 2;

  while (index < argv.length) {
    switch (argv[index]) {
      case "--dev": {
        options.isDev = true;
        index += 1;
        break;
      }
      case "--": {
        options.passing = argv.slice(index + 1);
        index = argv.length;
        break;
      }
      default: {
        console.error(`[BuildNative] Unknown argument: ${argv[index]}`);
        process.exit(1);
      }
    }
  }

  return options;
};

const napiArgs = ["--no-const-enum"];
const options = parseArgs();

if (!options.isDev) napiArgs.push("--release");
if (options.passing) napiArgs.push(...options.passing);

for (const mod of modules) {
  const cwd = `native/${mod}`;

  const buildType = options.isDev ? "debug" : "release";
  console.log(`[BuildNative] Building ${mod} (${buildType})`);

  const result = spawnSync("napi", ["build", ...napiArgs], {
    stdio: "inherit",
    shell: false,
    cwd,
  });

  if (result.error) {
    console.error("[BuildNative] Unable to start native build", result.error);
    process.exit(1);
  }
  if (result.signal) {
    console.error("[BuildNative] Native build terminated by signal", result.signal);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("[BuildNative] Native build failed", result.status);
    process.exit(result.status ?? 1);
  }
}
