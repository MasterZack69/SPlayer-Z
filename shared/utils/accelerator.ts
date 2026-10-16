/**
 * Parse, normalize, match, and display Electron accelerators.
 * Resolve CommandOrControl to Ctrl on Linux.
 */

/** Parsed accelerator. */
export interface ParsedAccelerator {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  /** Physical KeyboardEvent.code, such as "KeyA", "Space", or "ArrowLeft". */
  code: string;
}

/** Case-insensitive modifier tokens, including saved-setting aliases. */
const MODIFIER_TOKENS = new Set([
  "ctrl",
  "control",
  "cmd",
  "command",
  "meta",
  "super",
  "alt",
  "option",
  "shift",
  "commandorcontrol",
  "cmdorctrl",
]);

/**
 * Convert the final non-modifier token into KeyboardEvent.code.
 * Electron uses key names such as "A" and "Right" rather than physical codes.
 */
const keyToCode = (token: string): string => {
  const t = token.trim();
  if (!t) return "";
  // Letters.
  if (/^[A-Za-z]$/.test(t)) return `Key${t.toUpperCase()}`;
  // Digits.
  if (/^[0-9]$/.test(t)) return `Digit${t}`;
  // Arrow keys.
  const arrow: Record<string, string> = {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
  };
  const lower = t.toLowerCase();
  if (lower in arrow) return arrow[lower];
  // Function keys F1-F24.
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(t)) return `F${t.slice(1)}`;
  // Common keys.
  const map: Record<string, string> = {
    space: "Space",
    spacebar: "Space",
    enter: "Enter",
    return: "Enter",
    esc: "Escape",
    escape: "Escape",
    backspace: "Backspace",
    delete: "Delete",
    del: "Delete",
    tab: "Tab",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    insert: "Insert",
    plus: "Equal",
    "=": "Equal",
    "-": "Minus",
    minus: "Minus",
    "[": "BracketLeft",
    "]": "BracketRight",
    "\\": "Backslash",
    ";": "Semicolon",
    "'": "Quote",
    ",": "Comma",
    ".": "Period",
    "/": "Slash",
    "`": "Backquote",
  };
  if (lower in map) return map[lower];
  // Preserve unrecognized key names.
  return t;
};

/**
 * Parse an Electron accelerator.
 * @param accel Accelerator such as "CommandOrControl+Shift+R".
 */
export const parseAccelerator = (accel: string): ParsedAccelerator | null => {
  if (!accel) return null;
  const tokens = accel
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const result: ParsedAccelerator = {
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    code: "",
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (MODIFIER_TOKENS.has(lower)) {
      switch (lower) {
        case "ctrl":
        case "control":
          result.ctrl = true;
          break;
        case "cmd":
        case "command":
        case "meta":
        case "super":
          result.meta = true;
          break;
        case "alt":
        case "option":
          result.alt = true;
          break;
        case "shift":
          result.shift = true;
          break;
        case "commandorcontrol":
        case "cmdorctrl":
          result.ctrl = true;
          break;
      }
    } else {
      // Treat the non-modifier token as the final key.
      result.code = keyToCode(token);
    }
  }

  if (!result.code) return null;
  return result;
};

/**
 * Normalize modifier order and key casing.
 * Order: CommandOrControl > Super > Ctrl > Alt > Shift > Key.
 */
export const normalizeAccelerator = (accel: string): string => {
  if (!accel) return "";
  const tokens = accel
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);
  const mods = { cmdOrCtrl: false, cmd: false, ctrl: false, alt: false, shift: false };
  let key = "";
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (lower === "commandorcontrol" || lower === "cmdorctrl") mods.cmdOrCtrl = true;
    else if (lower === "cmd" || lower === "command" || lower === "meta" || lower === "super")
      mods.cmd = true;
    else if (lower === "ctrl" || lower === "control") mods.ctrl = true;
    else if (lower === "alt" || lower === "option") mods.alt = true;
    else if (lower === "shift") mods.shift = true;
    else key = t;
  }
  if (!key) return "";
  // Uppercase letter keys.
  if (/^[a-z]$/.test(key)) key = key.toUpperCase();
  const parts: string[] = [];
  if (mods.cmdOrCtrl) parts.push("CommandOrControl");
  if (mods.cmd) parts.push("Super");
  if (mods.ctrl) parts.push("Ctrl");
  if (mods.alt) parts.push("Alt");
  if (mods.shift) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
};

/** Compare a parsed accelerator without reparsing on the hot path. */
export const matchParsed = (event: KeyboardEvent, parsed: ParsedAccelerator): boolean => {
  if (event.ctrlKey !== parsed.ctrl) return false;
  if (event.metaKey !== parsed.meta) return false;
  if (event.altKey !== parsed.alt) return false;
  if (event.shiftKey !== parsed.shift) return false;
  return event.code === parsed.code;
};

/**
 * Format an accelerator for display.
 * @param accel Electron accelerator.
 */
export const formatAccelerator = (accel: string | null): string => {
  if (!accel) return "";
  const tokens = accel
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (lower === "commandorcontrol" || lower === "cmdorctrl") {
      out.push("Ctrl");
    } else if (lower === "cmd" || lower === "command" || lower === "meta" || lower === "super") {
      out.push("Super");
    } else if (lower === "ctrl" || lower === "control") {
      out.push("Ctrl");
    } else if (lower === "alt" || lower === "option") {
      out.push("Alt");
    } else if (lower === "shift") {
      out.push("Shift");
    } else if (lower === "left" || lower === "right" || lower === "up" || lower === "down") {
      const arrow: Record<string, string> = { left: "←", right: "→", up: "↑", down: "↓" };
      out.push(arrow[lower]);
    } else if (lower === "enter" || lower === "return") {
      out.push("Enter");
    } else if (lower === "space" || lower === "spacebar") {
      out.push("Space");
    } else if (/^[a-z]$/.test(lower)) {
      out.push(lower.toUpperCase());
    } else {
      out.push(t);
    }
  }
  return out.join(" + ");
};

/**
 * Build an accelerator from a keyboard event.
 * @param event Keyboard event.
 * @returns null for incomplete combinations, such as a modifier key alone.
 */
export const eventToAccelerator = (event: KeyboardEvent): string | null => {
  // A modifier by itself is an incomplete combination.
  const isModifierKey =
    event.code === "ControlLeft" ||
    event.code === "ControlRight" ||
    event.code === "ShiftLeft" ||
    event.code === "ShiftRight" ||
    event.code === "AltLeft" ||
    event.code === "AltRight" ||
    event.code === "MetaLeft" ||
    event.code === "MetaRight" ||
    event.code === "OSLeft" ||
    event.code === "OSRight";
  if (isModifierKey) return null;

  // Convert the physical key code back into an accelerator token.
  const codeToToken = (code: string): string => {
    if (code.startsWith("Key")) return code.slice(3); // KeyA → A
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Arrow")) return code.slice(5); // ArrowLeft → Left
    if (code.startsWith("F") && /^F[0-9]+$/.test(code)) return code; // F1
    const map: Record<string, string> = {
      Space: "Space",
      Enter: "Return",
      Escape: "Escape",
      Backspace: "Backspace",
      Delete: "Delete",
      Tab: "Tab",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      Insert: "Insert",
      Equal: "=",
      Minus: "-",
      BracketLeft: "[",
      BracketRight: "]",
      Backslash: "\\",
      Semicolon: ";",
      Quote: "'",
      Comma: ",",
      Period: ".",
      Slash: "/",
      Backquote: "`",
    };
    return map[code] ?? code;
  };

  const parts: string[] = [];
  // Linux Ctrl and Super are independent modifiers, including when pressed together.
  const cmdOrCtrl = event.ctrlKey;
  const otherCmdLike = event.metaKey;
  if (cmdOrCtrl) parts.push("CommandOrControl");
  if (otherCmdLike) parts.push("Super");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(codeToToken(event.code));
  return normalizeAccelerator(parts.join("+"));
};
