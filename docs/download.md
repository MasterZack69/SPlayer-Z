# Downloads and installation

Use [SPlayer-Z Releases](https://github.com/MasterZack69/SPlayer-Z/releases) for this fork. Assets and platforms depend on what has actually been published; if a channel has no release, choose another channel or build from source.

<DownloadPage />

## Choose a package

Choose an asset matching your operating system and CPU architecture. ARM64 and x64 are not interchangeable. On Linux, AppImage is the general-purpose option when provided; distribution packages need compatible system libraries. On macOS, prefer ARM64 for Apple Silicon. Windows packages remain in the current source; future platform plans are not a statement that support has already been removed.

The download widget requests release metadata from GitHub. GitHub is the direct route; selecting a third-party mirror sends the download request through that provider. Mirrors are not operated or verified by this fork. Do not substitute packages for the upstream project unless you intentionally want that project rather than SPlayer-Z.

## Build from source

```bash
git clone https://github.com/MasterZack69/SPlayer-Z.git
cd SPlayer-Z
git switch dev
pnpm install
pnpm build:linux
```

Use `pnpm build:mac` or `pnpm build:win` on an appropriate build host. Native dependencies are required; see [Native modules](/native) and [Contributing](/contributing). The package currently retains upstream identifiers such as `splayer-next` and `SPlayer-Next`; this documentation update does not rename binaries or data directories.

## NixOS and Nix

```bash
nix build .
./result/bin/splayer-next
```

For development, use `nix develop`. See [Nix and PipeWire diagnostics](/troubleshooting/nix) for development dependencies and audio tests.

## Updates

Check the release origin before accepting an in-app update. The current updater and packaging defaults still reference **SPlayer-Dev/SPlayer-Next**, not this fork. Disable automatic update checks if you do not want upstream release checks, and use this fork's Releases page or rebuild `dev` to stay on SPlayer-Z. Updating the documentation links does not change the application's update feed.

See [Linux Wayland](/troubleshooting/wayland), [Ubuntu startup](/troubleshooting/ubuntu-sandbox), and [macOS](/troubleshooting/macos) for platform-specific issues.
