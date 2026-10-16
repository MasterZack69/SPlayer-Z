export interface DownloadAsset {
  fileName: string;
  url: string;
  size: number;
  platform: string;
  arch: string;
  format: string;
}

const LINUX_FORMATS = [
  { suffix: ".appimage", format: "AppImage" },
  { suffix: ".deb", format: "deb" },
  { suffix: ".rpm", format: "rpm" },
  { suffix: ".pacman", format: "pacman" },
  { suffix: ".tar.gz", format: "tar.gz" },
];

const FORMAT_ORDER = [
  "installer",
  "dmg",
  "AppImage",
  "deb",
  "rpm",
  "pacman",
  "portable",
  "zip",
  "tar.gz",
];

/**
 * Prefer standard installers over portable packages and archives.
 * @param assets - Available release assets.
 * @returns A new array in recommended download order.
 */
export const sortDownloadAssets = (assets: DownloadAsset[]): DownloadAsset[] => {
  return [...assets].sort((left, right) => {
    const leftIndex = FORMAT_ORDER.indexOf(left.format);
    const rightIndex = FORMAT_ORDER.indexOf(right.format);
    return leftIndex - rightIndex;
  });
};

/**
 * Identify the platform, architecture, and package format of an asset.
 * @param name - Release asset filename.
 * @param url - Direct asset download URL.
 * @param size - Asset size in bytes.
 * @returns Parsed package information, or null for non-package assets.
 */
export const parseDownloadAsset = (
  name: string,
  url: string,
  size: number,
): DownloadAsset | null => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".blockmap") || lower.endsWith(".yml") || lower.includes("debug")) {
    return null;
  }

  let platform = "";
  let format = "";
  if (lower.endsWith(".exe")) {
    platform = "Windows";
    format = lower.includes("portable") ? "portable" : "installer";
  } else if (lower.endsWith(".dmg") || lower.endsWith(".zip")) {
    platform = "macOS";
    format = lower.endsWith(".dmg") ? "dmg" : "zip";
  } else {
    const linuxFormat = LINUX_FORMATS.find((item) => lower.endsWith(item.suffix));
    if (!linuxFormat) return null;
    platform = "Linux";
    ({ format } = linuxFormat);
  }

  let arch = "universal";
  if (lower.includes("arm64") || lower.includes("aarch64")) arch = "ARM64";
  else if (lower.includes("x64") || lower.includes("amd64") || lower.includes("x86_64")) {
    arch = "x64";
  }
  return { fileName: name, url, size, platform, arch, format };
};

/**
 * Prefer matching platform and architecture; use AppImage when available on Linux.
 * @param assets - Available release assets.
 * @param platform - Detected operating system.
 * @param arch - Detected CPU architecture.
 * @returns Up to two recommended assets.
 */
export const selectRecommendedAssets = (
  assets: DownloadAsset[],
  platform: string,
  arch: string,
): DownloadAsset[] => {
  if (!platform) return [];
  const samePlatform = assets.filter((asset) => asset.platform === platform);
  const matched = arch
    ? samePlatform.filter((asset) => asset.arch === arch || asset.arch === "universal")
    : samePlatform;
  const candidates = sortDownloadAssets(matched.length ? matched : samePlatform);
  if (platform === "Linux") {
    const appImages = candidates.filter((asset) => asset.format === "AppImage");
    return (appImages.length ? appImages : candidates).slice(0, 1);
  }
  return candidates.slice(0, 2);
};
