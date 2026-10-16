# Linux Wayland compatibility

SPlayer-Z runs on Electron/Chromium. Rendering, window controls, and global shortcuts can vary by compositor and portal backend.

## Vulkan and GPU output

The app disables the unsupported Vulkan path when it detects native Wayland; it does not disable GPU acceleration entirely. If an older build prints that Wayland is incompatible with Vulkan, rebuild the current `dev` branch and check the launch flags. Fluid backgrounds depend on rendering resources, so disabling all GPU acceleration is not a neutral fix.

For comparison, try an installed build under Xwayland:

```bash
/path/to/player --ozone-platform=x11
```

Use the actual executable path, for example `./result/bin/splayer-next` after a Nix build. Change a per-user desktop entry rather than overwriting a system package's launcher. Xwayland requires an available Xwayland service and can change shortcut behavior.

## Global shortcuts

Native Wayland shortcuts depend on `xdg-desktop-portal` and a backend implementing GlobalShortcuts. Approve the permission prompt if you want those bindings. KDE exposes application shortcuts in system settings. Restart the app after changing bindings if the portal needs to register them again.

```bash
dbus-send --session --dest=org.freedesktop.portal.Desktop --print-reply   --type=method_call /org/freedesktop/portal/desktop   org.freedesktop.DBus.Introspectable.Introspect | grep GlobalShortcuts
```

Backend support varies; consult your desktop's portal documentation. Do not weaken desktop-wide security settings just to restore a single shortcut.

## Reports

Include distribution, compositor, desktop environment, GPU/driver, Electron build, launch flags, and whether native Wayland or Xwayland is in use. Separate Chromium/GTK warnings from application exceptions and describe the visible failure. A warning alone is not evidence that the audio engine is broken.
