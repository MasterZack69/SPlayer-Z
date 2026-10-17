import { execFileSync } from "node:child_process";

/** Resolve reproducible source metadata, including builds without a .git directory.
 * @param env - Packager-provided source identity and timestamp.
 * @param git - Git command runner, injectable for archive-build tests.
 * @returns Commit identity and ISO source date; empty fields mean unavailable.
 */
export const getBuildInfo = (
  env: NodeJS.ProcessEnv = process.env,
  git: (args: string[]) => string = (args) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(),
): { commit: string; date: string } => {
  let commit = env.SPLAYER_COMMIT ?? "";
  let date = env.SPLAYER_COMMIT_DATE ?? "";
  if (!commit) {
    try {
      commit = git(["rev-parse", "HEAD"]);
    } catch {
      /* Source archives omit Git metadata. */
    }
  }
  if (!date) {
    try {
      date = git(["log", "-1", "--format=%cI"]);
    } catch {
      /* Nix supplies the source epoch. */
    }
  }
  if (!date && env.SOURCE_DATE_EPOCH && /^\d+$/.test(env.SOURCE_DATE_EPOCH)) {
    const timestamp = new Date(Number(env.SOURCE_DATE_EPOCH) * 1000);
    if (Number.isFinite(timestamp.getTime())) date = timestamp.toISOString();
  }
  return {
    commit: /^[a-f0-9]{7,40}(-dirty)?$/i.test(commit)
      ? `${commit.slice(0, 7)}${commit.endsWith("-dirty") ? "-dirty" : ""}`
      : "",
    date: Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : "",
  };
};
