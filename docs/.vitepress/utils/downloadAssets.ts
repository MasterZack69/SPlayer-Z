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

const FORMAT_ORDER = ["AppImage", "deb", "rpm", "pacman", "tar.gz"];

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

  const linuxFormat = LINUX_FORMATS.find((item) => lower.endsWith(item.suffix));
  if (!linuxFormat) return null;
  const platform = "Linux";
  const { format } = linuxFormat;
  let arch = "";
  if (lower.includes("arm64") || lower.includes("aarch64")) arch = "ARM64";
  else if (lower.includes("x64") || lower.includes("amd64") || lower.includes("x86_64")) {
    arch = "x64";
  }
  if (!arch) return null;
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
  if (platform !== "Linux" || !["x64", "ARM64"].includes(arch)) return [];
  const candidates = sortDownloadAssets(
    assets.filter((asset) => asset.platform === "Linux" && asset.arch === arch),
  );
  const appImages = candidates.filter((asset) => asset.format === "AppImage");
  return (appImages.length ? appImages : candidates).slice(0, 1);
};
