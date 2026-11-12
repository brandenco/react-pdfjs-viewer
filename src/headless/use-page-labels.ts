"use client";

import { useCallback } from "react";

import { loadPageLabels, pageNumberForLabel } from "../core/page-labels.ts";
import { useDocumentData } from "./use-document-data.ts";

export interface PageLabels {
  /** Each page's label, or `null` if the document has none (show page numbers then). */
  labels: readonly string[] | null;
  /** The label for a 1-based page number: its label if it has one, else the number. */
  labelOf: (pageNumber: number) => string;
  /** The 1-based page a label (or, failing that, a page number) refers to, or `null`. */
  pageNumberOf: (label: string) => number | null;
}

/** Page labels ("i", "ii", "1", …), for showing and typing pages the way the document numbers them. */
export function usePageLabels(): PageLabels {
  const { data } = useDocumentData(loadPageLabels);
  const labels = data ?? null;

  const labelOf = useCallback(
    (pageNumber: number) => labels?.[pageNumber - 1] ?? String(pageNumber),
    [labels],
  );
  const pageNumberOf = useCallback(
    (label: string) => {
      const fromLabel = labels ? pageNumberForLabel(labels, label) : null;
      if (fromLabel !== null) return fromLabel;
      const number = Number(label.trim());
      return Number.isInteger(number) ? number : null;
    },
    [labels],
  );
  return { labels, labelOf, pageNumberOf };
}
