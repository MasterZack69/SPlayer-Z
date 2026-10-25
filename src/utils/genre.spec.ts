import { describe, expect, it } from "vitest";
import { GENRE_ALIASES, getVisibleGenres, normalizeGenre } from "@shared/utils/genre";

describe("genre browsing aliases", () => {
  it.each(Object.entries(GENRE_ALIASES))("groups %s under %s", (alias, canonical) => {
    expect(normalizeGenre(` ${alias.toUpperCase()} `)).toBe(canonical);
  });
  it.each([
    "Pop/Rock",
    "Hip-Hop",
    "Rap",
    "Alternative Hip-Hop",
    "Alternative Rock",
    "Rock Alternativo",
    "constructor",
    "toString",
    "",
  ])("preserves unrelated genre %s", (name) => expect(normalizeGenre(` ${name} `)).toBe(name));
});

describe("generic Music label", () => {
  it("ignores Music case-insensitively by default without changing source metadata", () => {
    const genres = [" Music ", "MUSIC", "Dubstep", "Electronic Music", "Podcast", " "];
    expect(getVisibleGenres(genres)).toEqual(["Dubstep", "Electronic Music", "Podcast"]);
    expect(getVisibleGenres(genres, false)).toEqual([
      "Music",
      "MUSIC",
      "Dubstep",
      "Electronic Music",
      "Podcast",
    ]);
    expect(genres).toEqual([" Music ", "MUSIC", "Dubstep", "Electronic Music", "Podcast", " "]);
  });
  it("treats a Music-only track as having no visible genre while enabled", () => {
    expect(getVisibleGenres(["music"])).toEqual([]);
    expect(getVisibleGenres(["music"], false)).toEqual(["music"]);
    expect(getVisibleGenres(undefined)).toEqual([]);
  });
});

it.each(["Music", "music", "MUSIC", "mUsIc", " music "])(
  "hides %s with the toggle on and restores it with the toggle off",
  (name) => {
    expect(getVisibleGenres([name], true)).toEqual([]);
    expect(getVisibleGenres([name], false)).toEqual([name.trim()]);
  },
);
