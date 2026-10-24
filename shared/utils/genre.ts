/** Explicit browsing aliases; source metadata remains unchanged. */
export const GENRE_ALIASES: Readonly<Record<string, string>> = {
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
