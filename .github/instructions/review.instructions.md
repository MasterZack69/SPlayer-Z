---
applyTo: "**"
---

# Code Review Instructions

Write all review comments, suggestions, and summaries in **English**. Commit messages, PR titles and descriptions, and new or updated documentation must also be in English. Application localization strings may remain in their target languages.

## Review priorities

**Real problems first; style preferences last.** Prioritize:

- Runtime bugs, races, and memory/resource leaks: IPC listeners not cleaned up by finite-lifetime consumers, RAF loops, ResizeObserver instances, and Windows event hooks
- Mismatches between types and implementations, such as preload API declarations that differ from resolved values
- Main-process resource lifetimes: duplicate cleanup outside a window's `closed` event can cause double `stop()` calls or broadcasts
- Hard-coded values that override user settings: verify configuration reaches the underlying module
- Native COM lifetimes: check the return value of `CoInitializeEx`; call `CoUninitialize` only when initialization succeeded. See the `should_uninitialize` pattern in `native/taskbar-lyric/src/uia.rs`.
- Lock duration: clone an `Arc` and release the `Mutex` before invoking callbacks to avoid blocking other access or causing reentrant deadlocks
- Renderer persistence: do not put `TrackDetail` or large lyric strings in sessionStorage
- Consistent use of `@shared/*` types across processes

## Suggestions to avoid

- Do not suggest changes to established Prettier settings (double quotes, semicolons, 100 columns, and trailing commas).
- Do not suggest hand-written native module types; import them from `@splayer/<module>`.
- Do not suggest importing `electron-log` directly in the renderer or bypassing `@main/utils/logger` in the main process.
- Do not add defensive runtime validation for internal code; validate at system boundaries.
- Do not extract a small block into an abstraction without at least three real use cases.
- Do not add `removeAllListeners` to individual IPC channels. Push events use the preload `subscribe` helper (`on` plus a returned `unsubscribe`); additional bulk removal breaks that pattern.
- Do not flag application-level singleton subscriptions registered once as leaks. Such subscriptions intentionally live for the process lifetime; only finite-lifetime consumers must unsubscribe on unmount.

## Comment style

- Identify the file, line, and variable involved, and propose an actionable fix.
- Distinguish required fixes, suggestions, and style preferences so authors can prioritize.
- Before proposing changes that conflict with existing patterns, check `AGENTS.md` and `.github/copilot-instructions.md` for repository conventions.
