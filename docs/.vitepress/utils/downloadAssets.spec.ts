import { describe, expect, it } from "vitest";
import { parseDownloadAsset, selectRecommendedAssets, sortDownloadAssets } from "./downloadAssets";

const parse = (name: string) => parseDownloadAsset(name, `https://example.com/${name}`, 1024);

describe("parseDownloadAsset", () => {
  it.each([
    ["splayer-next-1.0.0-x64.AppImage", "x64", "AppImage"],
    ["splayer-next-1.0.0-amd64.deb", "x64", "deb"],
    ["splayer-next-1.0.0-aarch64.rpm", "ARM64", "rpm"],
    ["splayer-next-1.0.0-arm64.pacman", "ARM64", "pacman"],
    ["splayer-next-1.0.0-x86_64.tar.gz", "x64", "tar.gz"],
  ])("recognizes Linux asset %s", (name, arch, format) => {
    expect(parse(name)).toMatchObject({ platform: "Linux", arch, format });
  });

  it.each(["latest-linux.yml", "app.exe.blockmap", "splayer-debug.zip", "checksums.txt"])(
    "ignores non-package asset %s",
    (name) => {
      expect(parse(name)).toBeNull();
    },
  );
});

describe("selectRecommendedAssets", () => {
  it("prefers the installer on Windows", () => {
    const assets = [
      parse("splayer-next-1.0.0-portable-x64.exe"),
      parse("splayer-next-1.0.0-x64.exe"),
    ].filter((asset) => asset !== null);

    expect(selectRecommendedAssets(assets, "Windows", "x64").map((asset) => asset.format)).toEqual([
      "installer",
      "portable",
    ]);
  });

  it("recommends the matching architecture AppImage on Linux", () => {
    const assets = [
      parse("splayer-next-1.0.0-x64.deb"),
      parse("splayer-next-1.0.0-x64.pacman"),
      parse("splayer-next-1.0.0-x64.AppImage"),
      parse("splayer-next-1.0.0-arm64.AppImage"),
    ].filter((asset) => asset !== null);

    expect(selectRecommendedAssets(assets, "Linux", "x64").map((asset) => asset.format)).toEqual([
      "AppImage",
    ]);
  });

  it("falls back to an available Linux package without an AppImage", () => {
    const assets = [parse("splayer-next-1.0.0-x64.pacman")].filter((asset) => asset !== null);

    expect(selectRecommendedAssets(assets, "Linux", "x64").map((asset) => asset.format)).toEqual([
      "pacman",
    ]);
  });
});

describe("sortDownloadAssets", () => {
  it("Prefer standard installers over portable packages and archives.", () => {
    const assets = [
      parse("splayer-next-1.0.0-portable-x64.exe"),
      parse("splayer-next-1.0.0-x64.zip"),
      parse("splayer-next-1.0.0-x64.exe"),
    ].filter((asset) => asset !== null);

    expect(sortDownloadAssets(assets).map((asset) => asset.format)).toEqual([
      "installer",
      "portable",
      "zip",
    ]);
  });
});
