// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const docs = join(root, "docs");

/** Collect documentation sources without inspecting generated website output.
 * @param directory - Directory containing source files.
 * @returns Markdown, TypeScript, Vue, and CSS documentation sources.
 */
const sources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["dist", "cache"].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : /\.(md|ts|vue|css)$/.test(entry.name)
        ? [path]
        : [];
  });

const retired = [
  "api.md",
  "socket.md",
  "mcp.md",
  "plugins-usage.md",
  "plugins/index.md",
  "plugins/source.md",
  "plugins/control.md",
  "plugins/update.md",
];

const added = ["architecture", "library", "lyrics", "queue", "search", "troubleshooting/nix"];

describe("English documentation", () => {
  it("keeps documentation and contributor guidance free of untranslated Chinese prose", () => {
    const paths = [
      ...sources(docs),
      join(root, "AGENTS.md"),
      join(root, "native/audio-engine/README.md"),
      join(root, ".github/copilot-instructions.md"),
      join(root, ".github/instructions/review.instructions.md"),
      join(root, ".github/PULL_REQUEST_TEMPLATE.md"),
    ];
    for (const path of paths) {
      expect(readFileSync(path, "utf8"), relative(root, path)).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it.each(retired)("removes retired documentation at both routes: %s", (page) => {
    expect(existsSync(join(docs, page))).toBe(false);
    expect(existsSync(join(docs, "en", page))).toBe(false);
  });

  it.each(added)("documents current functionality at both routes: %s", (page) => {
    expect(existsSync(join(docs, `${page}.md`))).toBe(true);
    expect(existsSync(join(docs, "en", `${page}.md`))).toBe(true);
  });

  it("keeps compatibility pages linked to one canonical English source", () => {
    for (const path of sources(join(docs, "en")).filter((path) => path.endsWith(".md"))) {
      const canonical = join(docs, relative(join(docs, "en"), path));
      const content = readFileSync(path, "utf8");
      if (path === join(docs, "en/index.md")) {
        expect(content).toBe(readFileSync(canonical, "utf8"));
        continue;
      }
      const include = content.match(/^<!--@include: (.+)-->/m);
      expect(include, path).not.toBeNull();
      expect(resolve(path, "..", include![1].trim())).toBe(canonical);
    }
  });

  it("uses English and this fork for site navigation and releases", () => {
    const config = readFileSync(join(docs, ".vitepress/config.ts"), "utf8");
    expect(config).toContain('lang: "en-US"');
    expect(config).toContain("MasterZack69/SPlayer-Z");
    for (const page of retired) {
      expect(config).not.toContain(`link: "/${page.replace(/\.md$/, "")}"`);
    }
    const downloads = readFileSync(join(docs, ".vitepress/components/DownloadPage.vue"), "utf8");
    expect(downloads).toContain('const GITHUB_REPO = "MasterZack69/SPlayer-Z"');
    expect(downloads).not.toContain("SPlayer-Dev/SPlayer-Next");
  });

  it("preserves the accepted agreement marker and legal protections", () => {
    const agreement = readFileSync(join(docs, "agreement.md"), "utf8");
    expect(agreement).toContain("<!-- agreement-version: 3 -->");
    expect(agreement).toContain("AGPL-3.0 prevails");
    expect(agreement).toContain("mandatory laws in your jurisdiction still apply");
    expect(agreement).toContain("## 14. Limitation of liability");
  });
});
