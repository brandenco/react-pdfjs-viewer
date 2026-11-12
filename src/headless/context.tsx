"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

import { PdfViewerStore } from "../core/store.ts";
import type {
  CursorMode,
  DocumentInitParameters,
  PdfSource,
  SidebarView,
  ViewerState,
  ZoomPreset,
} from "../core/types.ts";

const StoreContext = createContext<PdfViewerStore | null>(null);

export interface PdfViewerProviderProps {
  /** URL, `URL`, or raw bytes. Changing it (by identity) loads a new document. */
  src: PdfSource | null | undefined;
  children?: ReactNode | undefined;
  /**
   * URL of the pdf.js worker, e.g. with Vite:
   * `import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"`.
   * Omit if you set `GlobalWorkerOptions.workerSrc` yourself.
   */
  workerSrc?: string | undefined;
  /** Extra `getDocument` options (cMapUrl, password, httpHeaders, …). Read on load only. */
  documentOptions?: Omit<DocumentInitParameters, "url" | "data"> | undefined;
  /** Default filename for downloads. Falls back to the URL's filename, then `document.pdf`. */
  filename?: string | undefined;
  /** A scale (1 = 100%) or a fit preset. Default `"page-fit"`. */
  initialScale?: number | ZoomPreset | undefined;
  /** 1-based page each document opens at. Read when the provider mounts. Default 1. */
  initialPage?: number | undefined;
  /** Whether the thumbnail sidebar starts open. Default `false`. */
  initialSidebarOpen?: boolean | undefined;
  /** What the sidebar shows first. Default `"thumbnails"`. */
  initialSidebarView?: SidebarView | undefined;
  /** Default `"text"`. */
  initialCursorMode?: CursorMode | undefined;
  /** Default 0.25. */
  minScale?: number | undefined;
  /** Default 5. */
  maxScale?: number | undefined;
  onDocumentLoad?: ((document: PDFDocumentProxy) => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
}

export function PdfViewerProvider(props: PdfViewerProviderProps): ReactNode {
  const { src, children, workerSrc, filename } = props;

  // Initial-* and min/max options are read once, when the store is created.
  const [store] = useState(
    () =>
      new PdfViewerStore({
        initialScale: props.initialScale,
        initialPage: props.initialPage,
        initialSidebarOpen: props.initialSidebarOpen,
        initialSidebarView: props.initialSidebarView,
        initialCursorMode: props.initialCursorMode,
        minScale: props.minScale,
        maxScale: props.maxScale,
      }),
  );

  // Reload only when `src` or the worker changes; `documentOptions` is read at load time.
  const documentOptions = useLatest(props.documentOptions);
  useEffect(() => {
    if (!src) return;
    return store.load(src, documentOptions.current ?? {}, workerSrc);
  }, [store, src, workerSrc, documentOptions]);

  useEffect(() => {
    store.setFilename(filename);
  }, [store, filename]);

  const onDocumentLoad = useLatest(props.onDocumentLoad);
  const onError = useLatest(props.onError);
  useEffect(() => {
    let previous = store.getState();
    return store.subscribe(() => {
      const next = store.getState();
      if (next.document && next.document !== previous.document) {
        onDocumentLoad.current?.(next.document);
      }
      if (next.error && next.error !== previous.error) {
        onError.current?.(next.error);
      }
      previous = next;
    });
  }, [store, onDocumentLoad, onError]);

  return <StoreContext value={store}>{children}</StoreContext>;
}

/** A ref that always holds the latest `value`, for reading inside effects without re-running them. */
function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** The viewer's store, for imperative access. Must be used inside `<PdfViewerProvider>`. */
export function usePdfViewerStore(): PdfViewerStore {
  const store = use(StoreContext);
  if (!store) {
    throw new Error("react-pdfjs-viewer: hooks must be used inside <PdfViewerProvider>");
  }
  return store;
}

/**
 * Subscribes to one slice of viewer state; the component re-renders only when that
 * slice changes. The selector must return existing values, not build new objects.
 */
export function usePdfViewerState<T>(selector: (state: ViewerState) => T): T {
  const store = usePdfViewerStore();
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getSnapshot = (): T => selector(store.getState());
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
