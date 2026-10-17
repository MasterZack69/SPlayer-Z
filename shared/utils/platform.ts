/** Supported Electron hosts and package architectures for this Linux-only application. */
export const SUPPORTED_ARCHITECTURES = ["x64", "arm64"] as const;

/** Reject unsupported hosts before starting development or packaging native binaries.
 * @param platform - Node host platform
 * @param arch - Node host architecture
 */
export const assertSupportedPlatform = (platform = process.platform, arch = process.arch): void => {
  if (platform !== "linux" || !SUPPORTED_ARCHITECTURES.some((candidate) => candidate === arch)) {
    throw new Error(
      `Unsupported platform: ${platform}/${arch}. SPlayer-Z requires x86_64 or ARM64 Linux.`,
    );
  }
};
