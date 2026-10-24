import { describe, expect, it } from "vitest";
import { GENRE_ALIASES, normalizeGenre } from "@shared/utils/genre";

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
