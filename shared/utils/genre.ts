/** Explicit browsing aliases; source metadata remains unchanged. */
export const GENRE_ALIASES: Readonly<Record<string, string>> = {
  alternative: "Alternative",
  alternativo: "Alternative",
  "hip-hop/rap": "Hip-Hop/Rap",
  "hip hop/rap": "Hip-Hop/Rap",
  "hiphop/rap": "Hip-Hop/Rap",
  "rap/hip-hop": "Hip-Hop/Rap",
  "rap/hip hop": "Hip-Hop/Rap",
  "rap/hiphop": "Hip-Hop/Rap",
};

/**
 * Resolve known genre aliases without conflating unrelated compound genres.
 * @param name - Original genre tag or navigation label.
 * @returns Canonical browsing label, or the trimmed original for unknown genres.
 */
export const normalizeGenre = (name: string): string => {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  return Object.hasOwn(GENRE_ALIASES, key) ? GENRE_ALIASES[key] : trimmed;
};

/**
 * Build genre labels for browsing without changing the source tags.
 * @param genres - Original metadata values.
 * @param ignoreMusicGenre - Whether to omit the exact generic Music label.
 * @returns Distinct, nonblank labels with aliases resolved.
 */
export const getVisibleGenres = (
  genres: readonly string[] | undefined,
  ignoreMusicGenre = true,
): string[] => [
  ...new Set(
    (genres ?? [])
      .map(normalizeGenre)
      .filter((name) => name && (!ignoreMusicGenre || name.toLowerCase() !== "music")),
  ),
];
