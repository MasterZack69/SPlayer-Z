import { describe, expect, it } from "vitest";
import { GENRE_ALIASES, normalizeGenre } from "@shared/utils/genre";

describe("genre browsing aliases", () => {
  it.each(Object.keys(GENRE_ALIASES))("groups %s under Hip-Hop/Rap", (alias) => {
    expect(normalizeGenre(` ${alias.toUpperCase()} `)).toBe("Hip-Hop/Rap");
  });
  it.each(["Pop/Rock", "Hip-Hop", "Rap", "Alternative Hip-Hop", "constructor", "toString", ""])(
    "preserves unrelated genre %s",
    (name) => expect(normalizeGenre(` ${name} `)).toBe(name),
  );
});
