"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useMemo } from "react";

import { usePdfViewerState, usePdfViewerStore } from "./context.tsx";
import type {
  CursorMode,
  LoadStatus,
  SearchMatch,
  SearchOptions,
  SearchStatus,
  ZoomMode,
  ZoomPreset,
} from "./core/types.ts";

// One hook per toolbar feature, so you can build your own toolbar. Every action
// function a hook returns keeps the same identity across renders, so it's safe to
// pass straight to `onClick` or list in effect dependencies.

export interface PdfDocumentInfo {
  status: LoadStatus;
  error: Error | null;
  document: PDFDocumentProxy | null;
  numPages: number;
}

export function usePdfDocument(): PdfDocumentInfo {
  const status = usePdfViewerState((state) => state.status);
  const error = usePdfViewerState((state) => state.error);
  const document = usePdfViewerState((state) => state.document);
  const numPages = usePdfViewerState((state) => state.numPages);
  return { status, error, document, numPages };
}

export interface PageNavigation {
  /** 1-based. */
  currentPage: number;
  numPages: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  /** 1-based; clamped to the document. */
  goToPage: (pageNumber: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
}

export function usePageNavigation(): PageNavigation {
  const store = usePdfViewerStore();
  const currentPage = usePdfViewerState((state) => state.currentPage);
  const numPages = usePdfViewerState((state) => state.numPages);
  const actions = useMemo(
    () => ({
      goToPage: (pageNumber: number) => store.goToPage(pageNumber),
      nextPage: () => store.nextPage(),
      previousPage: () => store.previousPage(),
      firstPage: () => store.firstPage(),
      lastPage: () => store.lastPage(),
    }),
    [store],
  );

  return {
    currentPage,
    numPages,
    canGoPrevious: currentPage > 1,
    canGoNext: currentPage < numPages,
    ...actions,
  };
}

export interface Zoom {
  /** 1 = 100%. */
  scale: number;
  mode: ZoomMode;
  minScale: number;
  maxScale: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Sets a fixed scale. */
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Fits the page to the viewport, and keeps it fitted until a fixed scale is set. */
  zoomTo: (preset: ZoomPreset) => void;
}

export function useZoom(): Zoom {
  const store = usePdfViewerStore();
  const scale = usePdfViewerState((state) => state.scale);
  const mode = usePdfViewerState((state) => state.zoomMode);
  const actions = useMemo(
    () => ({
      setScale: (value: number) => store.setScale(value),
      zoomIn: () => store.zoomIn(),
      zoomOut: () => store.zoomOut(),
      zoomTo: (preset: ZoomPreset) => store.zoomTo(preset),
    }),
    [store],
  );

  return {
    scale,
    mode,
    minScale: store.minScale,
    maxScale: store.maxScale,
    canZoomIn: scale < store.maxScale,
    canZoomOut: scale > store.minScale,
    ...actions,
  };
}

export interface CursorModeControls {
  /** `text` selects text; `hand` drags to pan. */
  mode: CursorMode;
  setMode: (mode: CursorMode) => void;
  toggle: () => void;
}

export function useCursorMode(): CursorModeControls {
  const store = usePdfViewerStore();
  const mode = usePdfViewerState((state) => state.cursorMode);
  const actions = useMemo(
    () => ({
      setMode: (next: CursorMode) => store.setCursorMode(next),
      toggle: () => store.toggleCursorMode(),
    }),
    [store],
  );

  return { mode, ...actions };
}

export interface Search {
  query: string;
  options: Readonly<Required<SearchOptions>>;
  status: SearchStatus;
  /** Sorted by page, then by position on the page. */
  matches: readonly SearchMatch[];
  /** Index into `matches`, or -1 when no match is active. */
  activeIndex: number;
  /** Pages scanned so far, for progress UI on large documents. */
  pagesSearched: number;
  /** Starts (or restarts) a search. Results stream in as pages are scanned. */
  search: (query: string, options?: SearchOptions) => Promise<void>;
  clear: () => void;
  next: () => void;
  previous: () => void;
  setActiveMatch: (index: number) => void;
}

export function useSearch(): Search {
  const store = usePdfViewerStore();
  const state = usePdfViewerState((viewer) => viewer.search);
  const actions = useMemo(
    () => ({
      search: (query: string, options?: SearchOptions) => store.search(query, options),
      clear: () => store.clearSearch(),
      next: () => store.nextMatch(),
      previous: () => store.previousMatch(),
      setActiveMatch: (index: number) => store.setActiveMatch(index),
    }),
    [store],
  );

  return { ...state, ...actions };
}

export interface Download {
  isDownloading: boolean;
  canDownload: boolean;
  /** Saves the original PDF bytes. Defaults to the provider's `filename`. */
  download: (filename?: string) => Promise<void>;
}

export function useDownload(): Download {
  const store = usePdfViewerStore();
  const isDownloading = usePdfViewerState((state) => state.isDownloading);
  const canDownload = usePdfViewerState((state) => state.document !== null);
  const download = useMemo(() => (filename?: string) => store.download(filename), [store]);

  return { isDownloading, canDownload, download };
}

export interface SidebarControls {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  toggle: () => void;
}

export function useSidebar(): SidebarControls {
  const store = usePdfViewerStore();
  const isOpen = usePdfViewerState((state) => state.isSidebarOpen);
  const actions = useMemo(
    () => ({
      setOpen: (next: boolean) => store.setSidebarOpen(next),
      toggle: () => store.toggleSidebar(),
    }),
    [store],
  );

  return { isOpen, ...actions };
}
