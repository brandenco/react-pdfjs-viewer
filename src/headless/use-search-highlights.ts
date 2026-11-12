"use client";

import type { TextLayer } from "pdfjs-dist";
import { useEffect, useMemo } from "react";

import { applyHighlights } from "../core/highlights.ts";
import { storeInternals } from "../core/store.ts";
import { splitIntoItemSegments, type PageText, type TextRange } from "../core/text.ts";
import type { SearchMatch } from "../core/types.ts";
import { usePdfViewerState, usePdfViewerStore } from "./context.tsx";

/**
 * Highlights this page's search matches on its text layer, and scrolls the active
 * match into view when the store asked for it (after "next match", for example).
 */
export function useSearchHighlights(pageIndex: number, textLayer: TextLayer | null): void {
  const store = usePdfViewerStore();
  const { ranges, activeMatch } = usePageMatches(pageIndex);

  useEffect(() => {
    if (!textLayer || ranges.length === 0) return;
    const layer = textLayer;

    let isCurrent = true;
    let removeHighlights: (() => void) | undefined;

    function highlight(pageText: PageText): void {
      if (!isCurrent) return;

      const highlights = applyHighlights(
        layer.textDivs,
        layer.textContentItemsStr,
        splitIntoItemSegments(pageText, ranges),
      );
      removeHighlights = highlights.remove;

      const internals = storeInternals(store);
      if (highlights.active && activeMatch && internals.takeMatchToReveal(activeMatch)) {
        internals.scrollIntoView(highlights.active);
      }
    }

    // Reading the text fails only if the document was closed meanwhile; nothing to show then.
    store.getPageText(pageIndex).then(highlight, () => {});

    return () => {
      isCurrent = false;
      removeHighlights?.();
    };
  }, [store, pageIndex, textLayer, ranges, activeMatch]);
}

interface PageMatches {
  ranges: readonly TextRange[];
  activeMatch: SearchMatch | null;
}

const NO_MATCHES: PageMatches = { ranges: [], activeMatch: null };

/** This page's slice of the search results. */
function usePageMatches(pageIndex: number): PageMatches {
  const matches = usePdfViewerState((state) => state.search.matches);
  const activeIndex = usePdfViewerState((state) => state.search.activeIndex);

  return useMemo(() => {
    const first = firstMatchOnOrAfter(matches, pageIndex);
    if (matches[first]?.pageIndex !== pageIndex) return NO_MATCHES;

    const ranges: TextRange[] = [];
    let activeMatch: SearchMatch | null = null;
    for (let index = first; matches[index]?.pageIndex === pageIndex; index++) {
      const match = matches[index]!;
      const isActive = index === activeIndex;
      if (isActive) activeMatch = match;
      ranges.push({ start: match.start, end: match.end, isActive });
    }
    return { ranges, activeMatch };
  }, [matches, activeIndex, pageIndex]);
}

/** Binary search: matches are sorted by page. */
function firstMatchOnOrAfter(matches: readonly SearchMatch[], pageIndex: number): number {
  let low = 0;
  let high = matches.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (matches[middle]!.pageIndex < pageIndex) low = middle + 1;
    else high = middle;
  }
  return low;
}
