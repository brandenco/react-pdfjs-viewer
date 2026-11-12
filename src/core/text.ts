import type { PDFPageProxy } from "pdfjs-dist";

/**
 * The searchable text of one page.
 *
 * `itemStrings` lines up 1:1 with pdf.js `TextLayer#textDivs` (one entry per text item),
 * which is what lets a search match be mapped back onto the rendered text layer.
 */
export interface PageText {
  /** All items joined; a space is inserted after items that end a line. */
  readonly text: string;
  /** Offset in `text` where each item starts. */
  readonly itemStarts: readonly number[];
  readonly itemStrings: readonly string[];
}

/** Used for both search and the text layer so their item lists stay aligned. */
export const TEXT_CONTENT_OPTIONS = { disableNormalization: true } as const;

export async function extractPageText(page: PDFPageProxy): Promise<PageText> {
  const content = await page.getTextContent(TEXT_CONTENT_OPTIONS);

  let text = "";
  const itemStarts: number[] = [];
  const itemStrings: string[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue; // marked-content markers have no text

    itemStarts.push(text.length);
    itemStrings.push(item.str);
    text += item.str;
    if (item.hasEOL) text += " ";
  }
  return { text, itemStarts, itemStrings };
}

/** A `[start, end)` range in a page's text, e.g. a search match. */
export interface TextRange {
  readonly start: number;
  readonly end: number;
  /** Whether this is the active search match. */
  readonly isActive: boolean;
}

/** The part of a `TextRange` that falls inside one text item. */
export interface ItemSegment {
  /** Index of the text item (and of its `TextLayer` div). */
  readonly item: number;
  /** Offsets within the item's own string. */
  readonly start: number;
  readonly end: number;
  readonly isActive: boolean;
}

/** Splits page-level ranges into per-item segments (a match can span several items). */
export function splitIntoItemSegments(
  pageText: PageText,
  ranges: readonly TextRange[],
): ItemSegment[] {
  const { itemStarts, itemStrings } = pageText;
  const segments: ItemSegment[] = [];

  for (const range of ranges) {
    for (let item = firstItemEndingAfter(pageText, range.start); item < itemStarts.length; item++) {
      const itemStart = itemStarts[item]!;
      if (itemStart >= range.end) break;

      const itemEnd = itemStart + itemStrings[item]!.length;
      const start = Math.max(range.start, itemStart) - itemStart;
      const end = Math.min(range.end, itemEnd) - itemStart;
      if (end > start) segments.push({ item, start, end, isActive: range.isActive });
    }
  }
  return segments;
}

/** Binary search for the first item that ends after `offset`. */
function firstItemEndingAfter({ itemStarts, itemStrings }: PageText, offset: number): number {
  let low = 0;
  let high = itemStarts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const itemEnd = itemStarts[middle]! + itemStrings[middle]!.length;
    if (itemEnd <= offset) low = middle + 1;
    else high = middle;
  }
  return low;
}
