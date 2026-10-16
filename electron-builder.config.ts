import { assertSupportedPlatform } from "./shared/utils/platform";
import type { Configuration } from "electron-builder";
import { readFileSync } from "node:fs";
import { SUPPORTED_AUDIO_EXTENSIONS } from "./shared/utils/audioFile";

/** Register supported audio extensions as desktop file associations. */
const fileAssociations = [...SUPPORTED_AUDIO_EXTENSIONS].map((extension) => {
  const ext = extension.slice(1);
  return {
    ext,
    description: `${ext.toUpperCase()} Audio File`,
    role: "Viewer" as const,
  };
});

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version as string;
const prereleaseChannel = /-(alpha|beta|nightly)(?:\.|$)/.exec(packageVersion)?.[1];
const inferredUpdateChannel = prereleaseChannel ?? "latest";
const updateChannel = process.env.UPDATE_CHANNEL ?? inferredUpdateChannel;

if (
  updateChannel !== "latest" &&
  updateChannel !== "beta" &&
  updateChannel !== "alpha" &&
  updateChannel !== "nightly"
) {
  throw new Error(`Unsupported update channel: ${updateChannel}`);
}
if (packageVersion.includes("-") && !prereleaseChannel) {
  throw new Error(`Unsupported prerelease version: ${packageVersion}`);
}
if (updateChannel !== inferredUpdateChannel) {
  throw new Error(`Version ${packageVersion} does not match update channel ${updateChannel}`);
}

assertSupportedPlatform();

const config: Configuration = {
  appId: "top.imsyy.splayer-next",
  productName: "SPlayer-Next",
  copyright: "Copyright © imsyy 2025",
  directories: { buildResources: "public" },
  fileAssociations,
  afterPack: "./scripts/after-pack.ts",
  compression: "maximum",
  generateUpdatesFilesForAllChannels: true,
  files: [
    "public/**",
    "out/main/**",
    "out/preload/**",
    "out/renderer/**",
    "!**/.vscode/*",
    "!src/**",
    "!native/**",
    "!scripts/**",
    "!electron/**",
    "!shared/**",
    "!electron.vite.config.{js,ts,mjs,cjs}",
    "!electron-builder.config.{js,ts,mjs,cjs}",
    "!uno.config.{js,ts,mjs,cjs}",
    "!{.eslintcache,eslint.config.mjs,auto-eslint.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}",
    "!{components.d.ts,auto-imports.d.ts}",
    "!{.env,.env.*,.npmrc,pnpm-lock.yaml}",
    "!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}",
    "!**/*.{d.ts,ts,map,md}",
    "!**/{CHANGELOG,README,readme}*",
    "!**/node_modules/better-sqlite3/{deps,src}/**",
  ],
  // Packaged application locales.
  electronLanguages: ["zh-CN", "en-US"],
  asarUnpack: ["public/**"],
  extraResources: [
    {
      from: "native/audio-engine",
      to: "native",
      filter: ["*.node"],
    },
    {
      from: "native/media-ctrl",
      to: "native",
      filter: ["*.node"],
    },
    {
      from: "native/opencc",
      to: "native",
      filter: ["*.node"],
    },
  ],
  extraFiles: [
    {
      from: "LICENSE",
      to: "LICENSE",
    },
  ],
  linux: {
    executableName: "SPlayer-Next",
    icon: "public/icons/favicon-512x512.png",
    artifactName: "${name}-${version}-${arch}.${ext}",
    maintainer: "imsyy.top",
    category: "Audio;Music;AudioVideo;",
    target: ["AppImage", "deb", "rpm", "tar.gz", "pacman"],
    syncDesktopName: true,
    desktop: { entry: { MimeType: "x-scheme-handler/orpheus;" } },
  },
  appImage: {
    artifactName: "${name}-${version}-${arch}.${ext}",
  },
  pacman: {
    artifactName: "${name}-${version}-${arch}.${ext}",
    depends: [
      "gtk3",
      "libnotify",
      "nss",
      "libxss",
      "libxtst",
      "xdg-utils",
      "at-spi2-core",
      "libsecret",
    ],
  },
  npmRebuild: false,
  electronDownload: {
    mirror: "https://npmmirror.com/mirrors/electron/",
  },
  publish: {
    provider: "github",
    owner: "SPlayer-Dev",
    repo: "SPlayer-Next",
    channel: updateChannel,
  },
};

export default config;
