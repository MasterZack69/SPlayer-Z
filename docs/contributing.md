# Contributing

Thank you for contributing to SPlayer-Z. This guide covers local development and the conventions for this fork.

## Project language

English is the required language for all contributions going forward:

- **Commits:** write commit subjects and any bodies in English, using Conventional Commits.
- **Pull requests:** write PR titles, descriptions, testing notes, and review discussions in English.
- **Documentation:** write all new or updated project documentation and contributor instructions in English.
- **Code comments:** write new or updated comments and JSDoc in English.

Existing non-English content can be translated incrementally; there is no requirement to rewrite old commit history. Application localization strings may remain in their target languages.

## Requirements

- **Node.js** >= 22.19.0
- **pnpm** >= 10
- **Rust toolchain** for [native modules](/native)

## Getting started

```bash
# Clone the fork and check out the development branch
git clone --branch dev https://github.com/MasterZack69/SPlayer-Z.git
cd SPlayer-Z

# Install dependencies
pnpm install

# Build native modules in debug mode and start Electron
pnpm dev

# Pass arguments to the application
pnpm dev -- [arguments]...
```

Set `SKIP_NATIVE_BUILD=true` to skip Rust compilation during renderer-only development when compatible prebuilt native modules are available.

## Building

```bash
pnpm build         # Clean, build native modules, type-check, and run electron-vite
pnpm build:win     # Package for Windows
pnpm build:mac     # Package for macOS
pnpm build:linux   # Package for Linux

# Build selected electron-builder targets instead of all configured targets
pnpm build:win nsis
pnpm build:mac dmg
pnpm build:linux tar.gz

# Build unpacked output for local testing in dist/*-unpacked
pnpm build:unpack
```

See [electron-builder targets](https://www.electron.build/docs/targets) for all package targets.

## Common scripts

```bash
pnpm typecheck           # TypeScript and Vue checks for main and renderer targets
pnpm lint                # ESLint
pnpm format              # Prettier
pnpm test                # Node and renderer tests
pnpm build:native        # Build Rust native modules only
pnpm build:native --dev  # Build Rust native modules in debug mode
```

## Project structure

```text
electron/main/      Main process: windows, IPC, native modules, and services
electron/preload/   contextBridge APIs exposed as window.api
src/                Vue 3 renderer application
windows/            Auxiliary window code and shared lyric utilities
native/             Rust native modules built with NAPI-RS
shared/             Cross-process types and defaults
```

## Code conventions

- **Comments:** use English and concise JSDoc for methods, including `@param name - description` and `@returns` when meaningful. Explain non-obvious reasons rather than restating code.
- **Formatting:** follow Prettier (double quotes, semicolons, 100 columns, and trailing commas). Format every changed file before committing; avoid unrelated formatting changes.
- **Validation:** run `pnpm typecheck`, `pnpm lint`, and relevant tests before submitting code changes. Build native modules when changing native code.
- **Native types:** import types from `@splayer/*`; do not hand-edit generated `native/*/index.d.ts` files.
- **Commit messages:** use `<type>: <English summary>`, for example `docs: clarify contribution requirements`. Keep the subject on one line. Do not add a body or bullets unless explicitly requested; if included, they must be in English. Choose the appropriate type: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `style`, or `chore`.

See [AGENTS.md](https://github.com/MasterZack69/SPlayer-Z/blob/dev/AGENTS.md) for detailed repository conventions.

## Application localization

The application uses [vue-i18n](https://vue-i18n.intlify.dev/). Locale files are stored in `src/i18n/locales/`. The English contribution policy does not prevent translations of application UI strings.

### Visual Studio Code

Install [i18n Ally](https://marketplace.visualstudio.com/items?itemName=Lokalise.i18n-ally). Open or create `.vscode/settings.json` (enable hidden files if needed) and configure:

```json
{
  "i18n-ally.localesPaths": "./src/i18n/locales/"
}
```

### JetBrains IDEs

1. Install [Easy i18n](https://plugins.jetbrains.com/plugin/16316-easy-i18n).
2. Open **Settings → Tools → Easy i18n**.
3. Under **Modules Configuration → Add new module**, enter `SPlayer-Z` (or another name) and use the plus button to create the module.
4. Select the `VUE_I18N` preset and set **Resource Configuration → Path template** to:

   ```text
   $PROJECT_DIR$/src/i18n/locales/{locale}.json
   ```

5. Optionally set **Common Configuration → Preview locale** to the locale you are working on, such as `en-US`.

## Pull requests

1. Create a feature branch from `dev`.
2. Keep each PR focused on one main feature or fix; split unrelated work into separate PRs.
3. Format changed files and run the checks relevant to the change.
4. Review and test all code yourself, including AI-generated code. Do not submit unverified changes.
5. Open the PR against `dev`, using an English title and description. Explain the motivation, changes, breaking changes (if any), and testing performed. Include screenshots or recordings for UI changes.
6. Write all PR discussion and review responses in English, and keep related documentation in English.

Thank you for contributing!
