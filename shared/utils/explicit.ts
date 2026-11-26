/** Trailing bracket pairs that may carry version labels (closing bracket to opening bracket). */
const BRACKET_PAIRS: Record<string, string> = {
  ")": "(",
  "]": "[",
  "）": "（",
  "】": "【",
};

/** A single explicit version label inside a bracket group. */
const EXPLICIT_TOKEN = /^explicit(?:\s+version)?$/i;

/** Parsed trailing bracket group of a title. */
interface TrailingGroup {
  /** Text before the bracket group */
  prefix: string;
  /** Opening bracket character that was matched */
  open: string;
  /** Closing bracket character that was matched */
  close: string;
  /** Bracket content split on `|` and trimmed */
  parts: string[];
}

/**
 * Parses a trailing bracket group, supporting `|`-combined labels.
 * @param text - Source text
 * @returns The trailing group, or null when the text does not end in a valid bracket pair
 */
const parseTrailingGroup = (text: string): TrailingGroup | null => {
  const trimmed = text.trimEnd();
  const close = trimmed.at(-1);
  const open = close ? BRACKET_PAIRS[close] : undefined;
  if (!open || !close) return null;
  const openIndex = trimmed.lastIndexOf(open);
  if (openIndex < 0) return null;
  const inner = trimmed.slice(openIndex + 1, -1);
  if (inner.includes(close)) return null;
  return {
    prefix: trimmed.slice(0, openIndex),
    open,
    close,
    parts: inner.split("|").map((part) => part.trim()),
  };
};

/**
 * Checks whether text is an explicit (parental advisory) version label.
 * @param text - Version suffix or full track title
 * @returns Whether the trailing bracket group contains a standalone explicit label
 */
export const isExplicitLabel = (text?: string | null): boolean => {
  if (!text) return false;
  const group = parseTrailingGroup(text);
  return group ? group.parts.some((part) => EXPLICIT_TOKEN.test(part)) : false;
};

/**
 * Removes an explicit label from a title while keeping other labels in the same bracket.
 * @param title - Track title
 * @returns The cleaned title, unchanged when it carries no explicit label
 */
export const stripExplicitLabel = (title?: string | null): string => {
  const text = title ?? "";
  const group = parseTrailingGroup(text);
  if (!group || !group.parts.some((part) => EXPLICIT_TOKEN.test(part))) return text;
  const kept = group.parts.filter((part) => part && !EXPLICIT_TOKEN.test(part));
  if (kept.length === 0) return group.prefix.trim();
  return `${group.prefix}${group.open}${kept.join("|")}${group.close}`.trim();
};
