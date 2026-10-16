#!/usr/bin/env node
import { spawn } from "node:child_process";
import { assertSupportedPlatform } from "../shared/utils/platform";

assertSupportedPlatform();
const server = spawn("electron-vite", ["dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
});
server.on("close", (code) => process.exit(code ?? 0));
server.on("error", (error) => {
  console.error("Unable to start the development server:", error);
  process.exit(1);
});
process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));
