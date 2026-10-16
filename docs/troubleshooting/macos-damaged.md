# macOS damaged-app warnings

Gatekeeper may reject an unsigned download, but a damaged-app warning can also mean corruption or tampering. Verify the download origin and checksum when provided, and obtain a fresh package before bypassing a warning.

For a verified package, try **System Settings → Privacy & Security → Open Anyway** or the supported Finder **Open** flow. If the known issue is specifically the quarantine attribute, remove only that attribute from the verified bundle:

```bash
xattr -rd com.apple.quarantine /Applications/SPlayer-Next.app
```

Use the actual bundle name and location. Do not disable Gatekeeper globally or remove every extended attribute without a specific reason. Administrative permission may be needed depending on ownership; do not run the application itself as root.

Prefer a native ARM64 package on Apple Silicon. If the problem persists, include the macOS version, architecture, package URL, and exact error in a report. Back up user data before any profile reset; deleting it is not a routine signing fix.
