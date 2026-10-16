import { Lexer, type Token } from "marked";
import type { LyricLine } from "@shared/types/lyrics";

export interface LyricTextStyle {
  start: number;
  end: number;
  bold: boolean;
  italic: boolean;
}

export interface LyricInlineText {
  text: string;
  styles: LyricTextStyle[];
  sourceOffsets: number[];
}

export type FormattedLyricLine = LyricLine & {
  inlineStyles: {
    main: LyricTextStyle[];
    translation: LyricTextStyle[];
    romanization: LyricTextStyle[];
  };
};

/**
 * Read emphasis only; HTML, links, images and other Markdown remain literal text.
 * @param source - Untrusted lyric text containing optional emphasis delimiters.
 * @returns Plain text, emphasis ranges and original offsets for timed-word mapping.
 */
export const parseLyricMarkdown = (source: string): LyricInlineText => {
  const result: LyricInlineText = { text: "", styles: [], sourceOffsets: [] };
  /**
   * Map supported inline tokens back to source offsets.
   * @param tokens - Inline tokens from marked.
   * @param offset - Starting source offset.
   * @param bold - Inherited bold emphasis.
   * @param italic - Inherited italic emphasis.
   */
  const walk = (tokens: Token[], offset: number, bold = false, italic = false): void => {
    for (const token of tokens) {
      if ((token.type === "strong" || token.type === "em") && "tokens" in token) {
        const delimiter = token.type === "strong" ? 2 : 1;
        walk(
          token.tokens ?? [],
          offset + delimiter,
          bold || token.type === "strong",
          italic || token.type === "em",
        );
      } else {
        const escaped = token.type === "escape";
        const text = escaped && "text" in token ? token.text : token.raw;
        const start = result.text.length;
        result.text += text;
        for (let i = 0; i < text.length; i++)
          result.sourceOffsets.push(offset + i + (escaped ? 1 : 0));
        if (bold || italic) {
          const previous = result.styles.at(-1);
          if (previous?.end === start && previous.bold === bold && previous.italic === italic)
            previous.end = result.text.length;
          else result.styles.push({ start, end: result.text.length, bold, italic });
        }
      }
      offset += token.raw.length;
    }
  };
  walk(Lexer.lexInline(source, { gfm: false }), 0);
  return result;
};

/**
 * Remove emphasis delimiters without retiming or splitting any lyric word.
 * @param line - One parsed lyric line, including auxiliary text and word metadata.
 * @param normalizeSpaces - Match AMLL's configured whitespace normalization.
 * @returns A display-only copy with formatting ranges carried through AMLL cloning.
 */
export const prepareLyricMarkdown = (
  line: LyricLine,
  normalizeSpaces: boolean,
): FormattedLyricLine => {
  const words = line.words.map((word) => ({
    ...word,
    word: normalizeSpaces ? word.word.replace(/\s+/g, " ") : word.word,
  }));
  const main = parseLyricMarkdown(words.map((word) => word.word).join(""));
  const translation = parseLyricMarkdown(line.translatedLyric);
  const romanization = parseLyricMarkdown(line.romanLyric);
  let rawOffset = 0;
  let visibleOffset = 0;
  for (const word of words) {
    const end = rawOffset + word.word.length;
    const start = visibleOffset;
    while (visibleOffset < main.sourceOffsets.length && main.sourceOffsets[visibleOffset] < end)
      visibleOffset++;
    word.word = main.text.slice(start, visibleOffset);
    rawOffset = end;
  }
  return {
    ...line,
    words,
    translatedLyric: translation.text,
    romanLyric: romanization.text,
    inlineStyles: {
      main: main.styles,
      translation: translation.styles,
      romanization: romanization.styles,
    },
  };
};

/**
 * Style text leaves without replacing AMLL's animated word/ruby containers.
 * @param root - Main or auxiliary lyric text element.
 * @param styles - Emphasis ranges in the visible base text.
 */
export const renderLyricMarkdown = (root: HTMLElement, styles: LyricTextStyle[]): void => {
  if (!styles.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.parentElement?.closest('[class*="rubyWord"], [class*="romanWord"]')) nodes.push(text);
  }
  let offset = 0;
  for (const node of nodes) {
    const start = offset;
    const text = node.data;
    offset += text.length;
    if (!text.length) continue;
    if (node.parentElement?.closest("[data-lyric-emphasis]")) continue;
    const ranges = styles.filter((style) => style.end > start && style.start < offset);
    if (!ranges.length) continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const style of ranges) {
      const from = Math.max(0, style.start - start);
      const to = Math.min(text.length, style.end - start);
      fragment.append(document.createTextNode(text.slice(cursor, from)));
      const element = document.createElement(style.bold ? "strong" : "em");
      element.dataset.lyricEmphasis = "";
      element.style.fontWeight = style.bold ? "900" : "inherit";
      element.style.fontStyle = style.italic ? "italic" : "normal";
      element.style.textTransform = style.bold ? "uppercase" : "none";
      // Add clearance only at the range end, never between animated letters.
      if (style.italic && start + to === style.end) element.style.marginInlineEnd = "0.18em";
      element.textContent = text.slice(from, to);
      fragment.append(element);
      cursor = to;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
};

/**
 * Reapply emphasis when AMLL virtualizes or rebuilds lines, not on every frame.
 * @param container - This player's DOM subtree.
 * @param targets - Current track's main and auxiliary text elements and styles.
 * @returns Cleanup that disconnects observation when lines change or the player unmounts.
 */
export const observeLyricMarkdown = (
  container: HTMLElement,
  targets: Map<HTMLElement, LyricTextStyle[]>,
): (() => void) => {
  for (const [element, styles] of targets) renderLyricMarkdown(element, styles);
  if (!targets.size) return () => {};
  const observer = new MutationObserver((mutations) => {
    const dirty = new Set<HTMLElement>();
    for (const mutation of mutations) {
      let node =
        mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
      while (node && node !== container) {
        if (targets.has(node)) {
          dirty.add(node);
          break;
        }
        node = node.parentElement;
      }
    }
    for (const element of dirty) renderLyricMarkdown(element, targets.get(element)!);
  });
  observer.observe(container, { subtree: true, childList: true, characterData: true });
  return () => observer.disconnect();
};
