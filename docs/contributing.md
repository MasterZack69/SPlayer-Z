# Contributing to SPlayer-Z

Contributions target **MasterZack69/SPlayer-Z**, normally the **dev** branch. This fork focuses on local audio and user-owned media servers. Read the root `AGENTS.md` before making changes.

## Project language

Use **English** for commit subjects and bodies, pull request titles and descriptions, reviews, discussions, documentation, contributor instructions, and all new or updated code comments. Localized application strings stay in their target languages. Do not rewrite existing Git history just to translate it.

Use Conventional Commits with a single-line subject, for example `fix: preserve active track when reordering the queue`. Do not add a commit body unless requested.

## Development setup

Use Node 24 or newer and pnpm 12, following the exact pnpm version declared in
`package.json` and its `packageManager` field. TypeScript uses the 6 series; Vue single-file components are checked with `vue-tsc`.
The packaged runtime is Electron 44; Nix pins Electron 44 and Node 24 as well. Install Node, pnpm, Rust/Cargo, Python, and the platform native build prerequisites. Linux/Nix users can start with `nix develop`; see [Native modules](native.md).

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds debug native modules before launching Electron. Avoid changing generated native declarations or auto-import files manually. For a UI-only run with existing native outputs, `SKIP_NATIVE_BUILD=true pnpm dev` skips the Rust build.

## Scope and code style

- Keep a PR focused on one feature or fix; separate unrelated work.
- Preserve the root README unless a task explicitly authorizes changing it.
- Document current behavior, not a conversation transcript or personal handoff.
- Use shared song-list, queue, search, and AMLL paths rather than page-specific copies.
- Write concise English JSDoc for new or modified methods, including meaningful parameters and return values.
- Follow Prettier: double quotes, semicolons, trailing commas, and a 100-character width.
- Use bounded caches, lightweight queue entries, and `shallowRef` for large track collections. Stop animation work for hidden surfaces.
- Keep server authentication in the main process. Do not log secrets or put tokens in renderer-visible URLs.
- Do not reintroduce removed public-catalog playback, plugins, external control services, lyric lookup, or auxiliary lyric windows as an incidental fix.

## Miscellaneous settings order

Keep **Skip Songs by Keywords** first in the Miscellaneous section; it is not a toggle.
All current and future Miscellaneous toggles must appear below it, never above it.

## Validation

Run the checks relevant to your change, and report their actual results:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For native changes, rebuild the module and run the appropriate Cargo and integration tests. Linux audio changes should include [PipeWire diagnostics](troubleshooting/nix.md). Only x86_64 and ARM64 Linux are supported. Run host-native checks and preserve both Linux CI targets; do not add Windows or macOS fallback code.

For UI work, test narrow and wide windows, keyboard and pointer interaction, and state persistence. For rendering, caching, or IPC changes, compare real main-process memory samples from `app.getAppMetrics()` before and after; browser-only previews do not replace Electron memory measurements. If a check cannot run, say why rather than claiming it passed.

Format every file included in a commit. Inspect the final diff for unintended files, generated outputs, secrets, and README changes.

## Documentation changes

Documentation lives as plain English Markdown under `docs/`; start with [the documentation index](index.md). Use relative `.md` links so readers can navigate directly on GitHub or in a local checkout. There is no website build or deployment step.

Update user guides and developer references when behavior changes. Add relevant pages to the index, verify local link targets, and remove documentation for retired interfaces rather than leaving executable examples for nonexistent endpoints. Documentation regression checks run with `pnpm test:web`.

## Pull requests and issues

Target `dev`, describe the motivation, summarize user-visible changes, and list tests and platforms. Include screenshots for visual changes. Review AI-generated work yourself. Follow `.github/PULL_REQUEST_TEMPLATE.md` and keep the PR discussion in English.

Report bugs through [this fork's issue tracker](https://github.com/MasterZack69/SPlayer-Z/issues), with a commit or version, OS, reproduction steps, expected and actual behavior, and redacted logs. Do not assume an upstream issue is automatically fixed in this fork.
