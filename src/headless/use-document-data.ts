"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";

import { readDocumentData } from "../core/document-data.ts";
import { usePdfViewerState } from "./context.tsx";

export type DocumentDataStatus = "idle" | "loading" | "ready" | "error";

/** Data read from the document on demand (outline, properties, …). */
export interface DocumentData<T> {
  /** `idle` while no document is loaded. */
  status: DocumentDataStatus;
  /** `null` until `status` is `ready`. */
  data: T | null;
  error: Error | null;
}

const IDLE = { status: "idle", data: null, error: null } as const;

/**
 * Reads `load(document)` once per document (shared by every component that asks for
 * the same `load`), and re-reads when the document changes. `load` must be a stable,
 * module-level function: it is the cache key.
 */
export function useDocumentData<T>(load: (doc: PDFDocumentProxy) => Promise<T>): DocumentData<T> {
  const doc = usePdfViewerState((state) => state.document);
  // The result is stored with the document it belongs to, so a new document never
  // shows the previous one's data, even for the render before the effect runs.
  const [result, setResult] = useState<{ doc: PDFDocumentProxy; value: DocumentData<T> } | null>(
    null,
  );

  useEffect(() => {
    if (!doc) return;
    let isCurrent = true;
    readDocumentData(doc, load).then(
      (data) => {
        if (isCurrent) setResult({ doc, value: { status: "ready", data, error: null } });
      },
      (error: unknown) => {
        if (!isCurrent) return;
        const value = error instanceof Error ? error : new Error(String(error));
        setResult({ doc, value: { status: "error", data: null, error: value } });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [doc, load]);

  if (!doc) return IDLE;
  if (result?.doc !== doc) return { status: "loading", data: null, error: null };
  return result.value;
}
