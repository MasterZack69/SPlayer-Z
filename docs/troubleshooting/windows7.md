# Unsupported Windows versions

The current Electron version does not support Windows 7, 8, or 8.1. Installing the Visual C++ runtime or operating-system updates does not make those systems compatible.

Use a Windows version supported by the packaged Electron release, or run a supported Linux/macOS build when available. Old Electron packages can contain known security issues and are not a supported workaround.

Windows-specific code still exists in the current project, including taskbar integration. Plans to remove Windows support in the future do not mean that removal has already happened. Linux development and host Cargo checks do not require Windows testing.
