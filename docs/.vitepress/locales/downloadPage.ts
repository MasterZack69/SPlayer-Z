export const DOWNLOAD_PAGE_COPY = {
  en: {
    loading: "Fetching the latest release…",
    fetchFailed: "Failed to fetch release information",
    openGitHub: "Download from GitHub",
    noRelease: "No release available",
    channelLabel: "Release channel",
    mirrorLabel: "Download mirror",
    recommended: "Recommended for your device",
    download: "Download",
    otherVersions: "Looking for another version?",
    allReleases: "View all releases",
    archHint: "For Linux installation and Nix builds, see",
    archHintLink: "installation instructions",
    channelEmpty: (name: string) =>
      `There is no ${name} release yet. Choose another channel or try again later.`,
    channels: {
      stable: { name: "Stable", description: "Stable releases intended for everyday use." },
      beta: { name: "Beta", description: "Mostly complete features with possible known issues." },
      alpha: { name: "Alpha", description: "Early features intended for testing only." },
    },
    formats: {
      AppImage: "Linux AppImage",
      deb: "Debian / Ubuntu (.deb)",
      rpm: "Fedora / RHEL (.rpm)",
      pacman: "Arch Linux (.pacman)",
      "tar.gz": "Linux archive (.tar.gz)",
    },
    universal: "Universal",
  },
} as const;
