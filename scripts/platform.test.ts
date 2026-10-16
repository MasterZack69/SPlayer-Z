import assert from "node:assert/strict";
import test from "node:test";
import { assertSupportedPlatform } from "../shared/utils/platform";

test("accepts exactly Linux x64 and ARM64 hosts", () => {
  assert.doesNotThrow(() => assertSupportedPlatform("linux", "x64"));
  assert.doesNotThrow(() => assertSupportedPlatform("linux", "arm64"));
  for (const [platform, arch] of [
    ["win32", "x64"],
    ["darwin", "arm64"],
    ["linux", "ia32"],
    ["linux", "arm"],
  ] as const) {
    assert.throws(() => assertSupportedPlatform(platform, arch), /Unsupported platform/);
  }
});
