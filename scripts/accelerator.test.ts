import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAccelerator,
  normalizeAccelerator,
  parseAccelerator,
} from "../shared/utils/accelerator";

test("Linux CommandOrControl maps to Ctrl without Super", () => {
  assert.deepEqual(parseAccelerator("CommandOrControl+Shift+R"), {
    ctrl: true,
    meta: false,
    alt: false,
    shift: true,
    code: "KeyR",
  });
  assert.equal(formatAccelerator("CommandOrControl+R"), "Ctrl + R");
});

test("Linux Ctrl and Super remain independent, including saved aliases", () => {
  const parsed = parseAccelerator("Ctrl+Super+A");
  assert.equal(parsed?.ctrl, true);
  assert.equal(parsed?.meta, true);
  assert.equal(normalizeAccelerator("cmd+ctrl+a"), "Super+Ctrl+A");
  assert.equal(formatAccelerator("Super+A"), "Super + A");
});
