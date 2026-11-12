import { normalizeQuery, normalizeText, type NormalizedText } from "./normalize.ts";
import { createYielder } from "./schedule.ts";
import type { PageText } from "./text.ts";
import type { SearchMatch, SearchOptions } from "./types.ts";

/**
 * Builds the regular expression for a search query, or `null` for an empty query. It
 * matches page text normalized with `normalizePageText` (the query is normalized the
 * same way). Regex syntax in the query is matched literally, and any run of whitespace
 * matches any run of whitespace (PDF text often breaks lines where the query has a space).
 */
export function buildSearchRegExp(query: string, options: Required<SearchOptions>): RegExp | null {
  const trimmed = normalizeQuery(query, { ignoreDiacritics: !options.matchDiacritics }).trim();
  if (!trimmed) return null;

  let pattern = escapeRegExp(trimmed).replace(/\s+/g, "\\s+");
  if (options.wholeWord) {
    const wordChar = "[\\p{L}\\p{N}_]";
    pattern = `(?<!${wordChar})${pattern}(?!${wordChar})`;
  }
  return new RegExp(pattern, options.caseSensitive ? "gu" : "giu");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface SearchProgress {
  /** Matches found since the previous progress report. */
  readonly newMatches: SearchMatch[];
  /** Pages scanned so far. */
  readonly pagesSearched: number;
  readonly isComplete: boolean;
}

/** How often (at most) to report progress while scanning. */
const PROGRESS_INTERVAL_MS = 80;

/**
 * Scans every page in order and reports matches in batches, so results stream into
 * the UI on large documents. Stops early when `signal` is aborted.
 */
export async function* scanPages(
  numPages: number,
  getPageText: (pageIndex: number) => Promise<PageText>,
  regex: RegExp,
  options: Required<SearchOptions>,
  signal: AbortSignal,
): AsyncGenerator<SearchProgress> {
  // Cached page text resolves as a microtask, so without explicit yields a re-search
  // of a large document would become one long, unresponsive task.
  const maybeYield = createYielder();
  let newMatches: SearchMatch[] = [];
  let lastReport = performance.now();

  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    // Pages are scanned one at a time so results arrive in page order.
    // oxlint-disable-next-line no-await-in-loop
    const pageText = await getPageText(pageIndex).catch(() => null);
    // oxlint-disable-next-line no-await-in-loop
    await maybeYield();
    if (signal.aborted) return;

    if (pageText) {
      const normalized = normalizePageText(pageText, !options.matchDiacritics);
      newMatches.push(...findMatches(normalized, regex, pageIndex));
    }

    const isComplete = pageIndex === numPages - 1;
    if (isComplete || performance.now() - lastReport > PROGRESS_INTERVAL_MS) {
      yield { newMatches, pagesSearched: pageIndex + 1, isComplete };
      newMatches = [];
      lastReport = performance.now();
    }
  }
}

/** Matches in normalized text, as ranges of the original page text (what's highlighted). */
function findMatches(text: NormalizedText, regex: RegExp, pageIndex: number): SearchMatch[] {
  const matches: SearchMatch[] = [];
  for (const match of text.text.matchAll(regex)) {
    const length = match[0].length;
    if (length === 0) continue;
    const { start, end } = text.toOriginal(match.index, match.index + length);
    matches.push({ pageIndex, start, end });
  }
  return matches;
}

// Normalized once per page and setting, then reused by every later search. Keyed by the
// PageText object, which the store caches per page and drops with the document.
const normalizedPages = new WeakMap<PageText, Map<boolean, NormalizedText>>();

/** A page's text, normalized for searching (see normalize.ts). */
export function normalizePageText(pageText: PageText, ignoreDiacritics: boolean): NormalizedText {
  let byOption = normalizedPages.get(pageText);
  if (!byOption) {
    byOption = new Map();
    normalizedPages.set(pageText, byOption);
  }
  let normalized = byOption.get(ignoreDiacritics);
  if (!normalized) {
    normalized = normalizeText(pageText.text, { ignoreDiacritics });
    byOption.set(ignoreDiacritics, normalized);
  }
  return normalized;
}

/**
 * Which match to activate first: the first one on or after the page the user is
 * reading. If there is none, wrap to the very first match, but only once the scan is
 * complete (a later page might still produce one). Returns -1 for "not yet".
 */
export function pickFirstActiveMatch(
  matches: readonly SearchMatch[],
  currentPageIndex: number,
  isComplete: boolean,
): number {
  const index = matches.findIndex((match) => match.pageIndex >= currentPageIndex);
  if (index !== -1) return index;
  return isComplete && matches.length > 0 ? 0 : -1;
}
