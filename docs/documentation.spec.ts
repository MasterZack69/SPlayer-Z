// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const docs = join(root, "docs");

/**
 * Collect the repository's Markdown documentation sources.
 * @param directory - Documentation source directory.
 * @returns Markdown source paths.
 */
const sources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : entry.name.endsWith(".md") ? [path] : [];
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

  it.each(retired)("removes retired documentation: %s", (page) => {
    expect(existsSync(join(docs, page))).toBe(false);
  });

  it.each(added)("documents current functionality: %s", (page) => {
    expect(existsSync(join(docs, `${page}.md`))).toBe(true);
  });

  it("uses resolvable Markdown links without a website renderer", () => {
    for (const path of sources(docs)) {
      const content = readFileSync(path, "utf8");
      expect(content, path).not.toContain("<!--@include:");
      expect(content, path).not.toContain("<DownloadPage");
      expect(content, path).not.toMatch(/^layout: home$/m);
      for (const match of content.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
        const href = match[1];
        if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("#")) continue;
        expect(href, path).not.toMatch(/^\//);
        const target = href.split("#")[0];
        expect(target, path).toMatch(/\.md$/);
        expect(existsSync(resolve(dirname(path), target)), `${path}: ${href}`).toBe(true);
      }
    }
  });

  it("keeps website tooling and deployment out of the repository", () => {
    for (const path of [
      "docs/.vitepress",
      "docs/en",
      "docs/public",
      ".github/workflows/docs.yml",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(false);
    }
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.devDependencies).not.toHaveProperty("vitepress");
    expect(Object.keys(pkg.scripts).some((name) => name.startsWith("docs:"))).toBe(false);
    const workflows = join(root, ".github/workflows");
    for (const file of readdirSync(workflows)) {
      expect(readFileSync(join(workflows, file), "utf8"), file).not.toMatch(
        /actions\/(?:configure-pages|upload-pages-artifact|deploy-pages)@|pages:\s*write/,
      );
    }
  });

  it("preserves the accepted agreement marker and legal protections", () => {
    const agreement = readFileSync(join(docs, "agreement.md"), "utf8");
    expect(agreement).toContain("<!-- agreement-version: 3 -->");
    expect(agreement).toContain("AGPL-3.0 prevails");
    expect(agreement).toContain("mandatory laws in your jurisdiction still apply");
    expect(agreement).toContain("## 14. Limitation of liability");
  });
});
