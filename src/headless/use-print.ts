"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useSyncExternalStore } from "react";

import { readDocumentData } from "../core/document-data.ts";
import { loadPermissions } from "../core/permissions.ts";
import { printDocument } from "../core/print.ts";
import type { PdfViewerStore } from "../core/store.ts";
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

interface PrintState {
  isPrinting: boolean;
  progress: PrintProgress | null;
}

const NOT_PRINTING: PrintState = { isPrinting: false, progress: null };

/**
 * One viewer's print job, shared by every `usePrint()` in it (the toolbar's button and
 * the "More actions" menu, say), so only one print runs at a time and they all show it.
 * Kept out of the store so printing stays tree-shakeable.
 */
class PrintSession {
  state: PrintState = NOT_PRINTING;
  #job: { doc: PDFDocumentProxy; controller: AbortController } | null = null;
  readonly #listeners = new Set<() => void>();

  constructor(store: PdfViewerStore) {
    // A new document, or closing the viewer, cancels printing the old one.
    store.subscribe(() => {
      if (this.#job && store.getState().document !== this.#job.doc) this.#job.controller.abort();
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getState = (): PrintState => this.state;

  /** Claims the session for printing `doc`. `null` if a print is already running. */
  begin(doc: PDFDocumentProxy): AbortController | null {
    if (this.#job) return null;
    const controller = new AbortController();
    this.#job = { doc, controller };
    this.#set({ isPrinting: true, progress: null });
    return controller;
  }

  reportProgress(progress: PrintProgress): void {
    if (this.#job) this.#set({ isPrinting: true, progress });
  }

  end(): void {
    this.#job = null;
    this.#set(NOT_PRINTING);
  }

  cancel(): void {
    this.#job?.controller.abort();
  }

  #set(state: PrintState): void {
    this.state = state;
    for (const listener of this.#listeners) listener();
  }
}

const sessions = new WeakMap<PdfViewerStore, PrintSession>();

function sessionFor(store: PdfViewerStore): PrintSession {
  let session = sessions.get(store);
  if (!session) {
    session = new PrintSession(store);
    sessions.set(store, session);
  }
  return session;
}

/** Prints the whole document at print resolution, in the viewer's rotation. */
export function usePrint(): Print {
  const store = usePdfViewerStore();
  const session = sessionFor(store);
  const doc = usePdfViewerState((state) => state.document);
  const permissions = useDocumentData(loadPermissions);
  const { isPrinting, progress } = useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState,
  );

  // Permissions may not be read yet; allow printing until they say otherwise.
  const isAllowed = permissions.data?.print ?? true;

  const print = useCallback(
    async (options: { dpi?: number; ignorePermissions?: boolean } = {}) => {
      const current = store.getState().document;
      if (!current) return;
      // Claimed before any await, so a second call can't start another print meanwhile.
      const controller = session.begin(current);
      if (!controller) return;
      const { signal } = controller;
      try {
        if (!options.ignorePermissions) {
          const allowed = await readDocumentData(current, loadPermissions);
          signal.throwIfAborted();
          if (allowed && !allowed.print) {
            throw new Error("The document's permissions don't allow printing");
          }
        }
        await printDocument(current, {
          dpi: options.dpi,
          rotation: store.getState().rotation,
          signal,
          onProgress: (pagesRendered, pageCount) =>
            session.reportProgress({ pagesRendered, pageCount }),
        });
      } finally {
        session.end();
      }
    },
    [store, session],
  );

  const cancel = useCallback(() => session.cancel(), [session]);

  return { canPrint: doc !== null && isAllowed, isPrinting, progress, print, cancel };
}
