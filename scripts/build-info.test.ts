import assert from "node:assert/strict";
import test from "node:test";
import { getBuildInfo } from "./build-info";

/** Simulate a source archive with no Git executable or repository. */
const noGit = (): never => {
  throw new Error("not a git repository");
};
test("Nix source builds accept explicit identity and a reproducible source epoch", () => {
  assert.deepEqual(
    getBuildInfo({ SPLAYER_COMMIT: "abcdef1234567890", SOURCE_DATE_EPOCH: "1792180800" }, noGit),
    {
      commit: "abcdef1",
      date: new Date(1792180800000).toISOString(),
    },
  );
});
test("Git checkouts expose their actual commit and date", () => {
  assert.deepEqual(
    getBuildInfo({}, (args) => (args[0] === "rev-parse" ? "abcdef1234" : "2026-10-17T00:00:00Z")),
    {
      commit: "abcdef1",
      date: "2026-10-17T00:00:00.000Z",
    },
  );
});
test("missing and invalid metadata never invents a commit or invalid date", () => {
  assert.deepEqual(getBuildInfo({}, noGit), { commit: "", date: "" });
  assert.deepEqual(
    getBuildInfo(
      { SPLAYER_COMMIT: "unknown", SPLAYER_COMMIT_DATE: "unknown", SOURCE_DATE_EPOCH: "garbage" },
      noGit,
    ),
    { commit: "", date: "" },
  );
});

test("dirty Nix checkouts identify the base commit without claiming a clean build", () => {
  assert.equal(
    getBuildInfo({ SPLAYER_COMMIT: "abcdef1234567890-dirty" }, noGit).commit,
    "abcdef1-dirty",
  );
});
