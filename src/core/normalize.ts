/**
 * Text normalization for search, so a query matches text that looks the same but is
 * encoded differently, the way pdf.js' own find controller does:
 *
 * - Compatibility characters (NFKC): ligatures ("ﬁ" → "fi"), full-width letters
 *   ("ＰＤＦ" → "PDF"), non-breaking spaces, and so on.
 * - Optionally, accents: "café" and "cafe" match each other.
 * - Soft hyphens are dropped, and a word hyphenated at a line end is joined
 *   ("exam-⏎ple" → "example").
 *
 * The page text is normalized together with a map back to the original text, so a
 * match found in the normalized text highlights the right characters on the page.
 */

export interface NormalizeOptions {
  /** Remove accents (combining diacritical marks) from Latin, Greek and Cyrillic letters. */
  readonly ignoreDiacritics: boolean;
}

export interface NormalizedText {
  readonly text: string;
  /** The range in the original text that a `[start, end)` range of `text` came from. */
  toOriginal(start: number, end: number): { start: number; end: number };
}

/** Hyphens that can split a word at the end of a line. */
const LINE_END_HYPHENS = new Set(["-", "‐", "­"]);
const SOFT_HYPHEN = "­";
/**
 * Combining Diacritical Marks: the accents of Latin, Greek and Cyrillic. Marks in other
 * scripts (Devanagari vowel signs, Hebrew points, …) change the letter, so they're kept.
 */
const DIACRITICS = /[̀-ͯ]/g;
const COMBINING_MARK = /\p{M}/u;
const LETTER = /\p{L}/u;
/** Anything normalization could change: non-ASCII characters, or a hyphen ending a line. */
const MAY_NEED_NORMALIZING = /[\u0080-\uFFFF]|-\n/;

/** Normalizes `original`, keeping a map from normalized offsets back to original ones. */
export function normalizeText(original: string, options: NormalizeOptions): NormalizedText {
  if (!MAY_NEED_NORMALIZING.test(original)) return identity(original);

  let text = "";
  // For each UTF-16 unit of `text`: the range of `original` it came from.
  const starts: number[] = [];
  const ends: number[] = [];
  const emit = (output: string, start: number, end: number): void => {
    text += output;
    for (let unit = 0; unit < output.length; unit++) {
      starts.push(start);
      ends.push(end);
    }
  };

  let index = 0;
  while (index < original.length) {
    const char = original[index]!;

    // A word hyphenated at the end of a line: drop the hyphen and the line break.
    if (
      LINE_END_HYPHENS.has(char) &&
      original[index + 1] === "\n" &&
      LETTER.test(text.at(-1) ?? "") &&
      LETTER.test(codePointAt(original, index + 2))
    ) {
      index += 2;
      continue;
    }
    // Soft hyphens are invisible anywhere else.
    if (char === SOFT_HYPHEN) {
      index++;
      continue;
    }
    // Plain ASCII without an accent after it: nothing to normalize (the fast path).
    if (char < "\u0080" && !COMBINING_MARK.test(codePointAt(original, index + 1))) {
      emit(char, index, index + 1);
      index++;
      continue;
    }

    // One character with the accents that follow it, normalized as a unit, so a letter
    // and a combining accent compare equal to the precomposed letter.
    let end = index + codePointAt(original, index).length;
    while (end < original.length && COMBINING_MARK.test(codePointAt(original, end))) {
      end += codePointAt(original, end).length;
    }
    let output = original.slice(index, end).normalize("NFKC");
    if (options.ignoreDiacritics) {
      output = output.normalize("NFD").replace(DIACRITICS, "").normalize("NFC");
    }
    emit(output, index, end);
    index = end;
  }

  return {
    text,
    toOriginal(start, end) {
      // A match ending inside an expansion ("f" of "ﬁ") covers the whole original
      // character: the page can't highlight half a glyph.
      return {
        start: starts[start] ?? original.length,
        end: ends[end - 1] ?? original.length,
      };
    },
  };
}

/** The query, normalized the same way as the page text. */
export function normalizeQuery(query: string, options: NormalizeOptions): string {
  return normalizeText(query, options).text;
}

function identity(text: string): NormalizedText {
  return { text, toOriginal: (start, end) => ({ start, end }) };
}

/** The whole code point at `index` (one or two UTF-16 units), or "" past the end. */
function codePointAt(text: string, index: number): string {
  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
}
