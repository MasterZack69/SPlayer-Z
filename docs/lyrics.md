# Lyrics

## One rendering engine

Now Playing uses **AMLL** for lyric playback. There is no second engine or engine switcher. Line-synchronized lyrics and supported word-timed formats use the same rendering path.

Lyrics come from local sidecar files, embedded audio metadata, or the configured media server. The client does not search public music platforms or an online TTML database for a match. A media server can supply its own lyrics; that is distinct from public lyric lookup.

## Local files and TTML

Keep a sidecar lyric file with its matching audio file, using the same base filename, for example `Song.flac` and `Song.lrc` or `Song.ttml`. The local loader chooses a recognized sidecar according to the lyric-format priority, then falls back to embedded lyrics if necessary.

TTML support remains available. The separate metadata-matched **local TTML library** feature and folder setting have been removed; there is no need to configure a second lyric-library directory.

Supported format identifiers and their default priority are defined in `shared/types/lyrics.ts`: TTML, LYS, QRC, KRC, YRC, LRC, ASS, and SRT. Actual display depends on valid timing and the supplied file contents.

## Apple TTML audio offsets

Playback honors signed `lyricOffset` values in the Apple `iTunesMetadata` container:

```xml
<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">
  <audio lyricOffset="0.369" role="ext-always" />
  <audio lyricOffset="-0.366" role="spatial" />
</iTunesMetadata>
```

Values are in **seconds**, converted to milliseconds. `0.369` moves lyric timestamps **369 ms later**; `-0.369` moves them **369 ms earlier**. Times before the start of the track are clamped to zero. Line, word, backing-vocal and ruby timings move together, so highlighting, seeking and current-line tracking stay aligned.

- Mono, stereo and sources with unknown channel counts use `ext-always`, or an audio entry without a role if no `ext-always` entry exists.
- Multichannel sources (more than two decoded audio channels, including supported Dolby sources) prefer `role="spatial"`. If it is absent, they use the common offset instead.
- These entries are **alternative audio versions**, not cumulative adjustments: a spatial offset replaces the common offset, rather than being added to it. A zero offset is valid.
- Selection uses the **source audio's channel count**, not the speaker/output-device configuration. Invalid offset values and unrelated roles are ignored.

The source TTML is preserved. Your manual per-track lyric adjustment remains independent and can still fine-tune playback after the file's automatic offset is applied.

## Compact LRC without physical newlines

A compact line-timed LRC string can contain successive line timestamps without newline characters:

```text
[00:07.450]First line[00:10.790]Second line[00:14.90]Third line
```

Each line timestamp starts a displayed lyric line. Fractional timestamps with different precision are accepted. This normalization is not a blanket replacement of every time marker: enhanced LRC word timing and other word-by-word formats must retain their words within the original line.

## Bold and italic

Basic inline emphasis is supported:

```text
You're *italic*, I'm in **bold**
```

Italic text is slanted with clearance at the end so the following text does not collide with it. Bold text is displayed in uppercase with heavier styling. Nested emphasis is supported; this is not a full Markdown document renderer and arbitrary HTML is not executed.

Formatting markers do not become sung words or change lyric timing. The renderer preserves text-to-word offsets and applies styles to the relevant spans. Uppercasing is a presentation choice, not a rewrite of the source lyric file.

## Lyric credits

**Settings → Lyrics → Show Lyric Credits** is on by default and shows all available lyric-file creators and songwriters below the lyrics. Credits come from the active lyric file, not an online lookup or audio-tag scan. Lyric-file creator handles link to GitHub; songwriter names are plain text. Disable the toggle to hide all credits. Missing credit types are omitted. When credits are disabled or no metadata is available, no footer scrolling target is mounted.

## Troubleshooting and development

Check the sidecar filename, encoding, format, timestamps, and selected format priority. A track with no sidecar, embedded lyrics, or server lyrics will not gain lyrics through an automatic public lookup.

Parsing and emphasis helpers live under `src/utils/lyric/`; source resolution is under `src/services/lyric/`. Regression coverage must include compact LRC, enhanced word timing, emphasis across word boundaries, spaces after emphasis, translations, and untrusted markup. Pause animation work when the player is hidden.
