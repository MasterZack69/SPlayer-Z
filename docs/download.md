# Downloads and installation

Use [SPlayer-Z Releases](https://github.com/MasterZack69/SPlayer-Z/releases) for this fork. Assets and platforms depend on what has actually been published; if a channel has no release, choose another channel or build from source.

<DownloadPage />

## Choose a package

SPlayer-Z supports **x86_64 Linux** and **ARM64 Linux** only. Choose the package matching your CPU architecture; x64 and ARM64 binaries are not interchangeable. AppImage is the general-purpose option when published. Distribution packages require compatible system libraries. Windows, macOS, 32-bit Linux, and universal packages are not supported.

The download widget requests release metadata from GitHub. GitHub is the direct route; selecting a third-party mirror sends the download request through that provider. Mirrors are not operated or verified by this fork. Do not substitute packages for the upstream project unless you intentionally want that project rather than SPlayer-Z.

## Build from source

```bash
git clone https://github.com/MasterZack69/SPlayer-Z.git
cd SPlayer-Z
git switch dev
pnpm install
pnpm build:linux
```

Build on the matching Linux architecture with `pnpm build:linux --x64` or `pnpm build:linux --arm64`. Native dependencies are required; see [Native modules](/native) and [Contributing](/contributing). Packages use the `splayer-z` executable and the `SPlayer-Z` application data directory.

## NixOS and Nix

```bash
nix build .
./result/bin/splayer-z
```

For development, use `nix develop`. See [Nix and PipeWire diagnostics](/troubleshooting/nix) for development dependencies and audio tests.

## Updates

The in-app updater and packaged update metadata use [SPlayer-Z Releases](https://github.com/MasterZack69/SPlayer-Z/releases). AppImage and supported distribution packages can update in-app; development and unpacked builds open the release page. A channel without a published SPlayer-Z release has no update available; it never falls back to another project.

See [Linux Wayland](/troubleshooting/wayland), [Ubuntu startup](/troubleshooting/ubuntu-sandbox) for platform-specific issues.
