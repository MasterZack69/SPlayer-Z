# Ubuntu sandbox and startup problems

Electron needs a functioning Chromium sandbox and its runtime libraries. Start from the exact terminal error rather than applying every workaround at once.

## Sandbox initialization

If the error names `chrome-sandbox`, verify the package origin and whether the packaging method configured the helper correctly. For a trusted installed package, its sandbox helper may require root ownership and mode `4755`; follow the package or distribution instructions rather than changing arbitrary binaries found on disk.

Other errors concern user namespaces or distribution AppArmor policy. Check your Ubuntu version and its supported Electron/AppImage policy. Avoid changing global namespace or AppArmor settings as a first response.

`--no-sandbox` disables an important security boundary. It is not a recommended permanent launcher setting. Prefer a correctly packaged installation or a supported distribution-specific fix.

## Missing libraries

A missing shared-library error identifies the dependency to install. Electron needs GTK, NSS, audio, graphics, and desktop libraries. Package names differ by distribution version, including Ubuntu's time64 transitions; use your package manager's matching package rather than copying an old install list blindly.

A development build also needs native headers and tools; see [Native modules](../native.md). A graphical WSL session requires working display and audio integration, not just a successful Rust build.

## Filing an issue

Include distribution/version, package format, exact launch command and error, architecture, and `uname -a`. Redact personal paths. Do not run the player as root to work around sandbox initialization.
