"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { readDocumentData } from "../core/document-data.ts";
import { loadPermissions } from "../core/permissions.ts";
import { printDocument } from "../core/print.ts";
import { usePdfViewerState, usePdfViewerStore } from "./context.tsx";
import { useDocumentData } from "./use-document-data.ts";

export interface PrintProgress {
  pagesRendered: number;
  pageCount: number;
}

export interface Print {
  /**
   * Whether a document is loaded and its author allows printing. pdf.js doesn't enforce
   * this; `print()` respects it unless called with `{ ignorePermissions: true }`.
   */
  canPrint: boolean;
  isPrinting: boolean;
  /** While pages are being prepared, for a progress indicator. `null` otherwise. */
  progress: PrintProgress | null;
  /**
   * Renders every page for print and opens the browser's print dialog. Resolves once the
   * dialog closes. Rejects with an `AbortError` if `cancel()` was called first.
   */
  print: (options?: { dpi?: number; ignorePermissions?: boolean }) => Promise<void>;
  /** Stops preparing pages. Has no effect once the print dialog is open. */
  cancel: () => void;
}

/** Prints the whole document at print resolution, in the viewer's rotation. */
export function usePrint(): Print {
  const store = usePdfViewerStore();
  const doc = usePdfViewerState((state) => state.document);
  const permissions = useDocumentData(loadPermissions);
  const [progress, setProgress] = useState<PrintProgress | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const controller = useRef<AbortController>(null);

  // Permissions may not be read yet; allow printing until they say otherwise.
  const isAllowed = permissions.data?.print ?? true;

  const print = useCallback(
    async (options: { dpi?: number; ignorePermissions?: boolean } = {}) => {
      const current = store.getState().document;
      if (!current || controller.current) return;
      if (!options.ignorePermissions) {
        const allowed = await readDocumentData(current, loadPermissions);
        if (allowed && !allowed.print) {
          throw new Error("The document's permissions don't allow printing");
        }
      }

      const abort = new AbortController();
      controller.current = abort;
      setIsPrinting(true);
      try {
        await printDocument(current, {
          dpi: options.dpi,
          rotation: store.getState().rotation,
          signal: abort.signal,
          onProgress: (pagesRendered, pageCount) => setProgress({ pagesRendered, pageCount }),
        });
      } finally {
        controller.current = null;
        setIsPrinting(false);
        setProgress(null);
      }
    },
    [store],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  // A new document, or unmounting, cancels printing the old one.
  useEffect(() => (doc ? cancel : undefined), [doc, cancel]);

  return { canPrint: doc !== null && isAllowed, isPrinting, progress, print, cancel };
}
