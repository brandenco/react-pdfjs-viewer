import type { getDocument, PDFDocumentProxy } from "pdfjs-dist";

/** Anything pdf.js can open. Binary data is copied before being handed to the worker. */
export type PdfSource = string | URL | Uint8Array | ArrayBuffer;

/** Options for pdf.js `getDocument()` (cMapUrl, password, httpHeaders, …). */
export type DocumentInitParameters = NonNullable<Parameters<typeof getDocument>[0]>;

export type LoadStatus = "idle" | "loading" | "ready" | "error";

/** `text` selects text; `hand` drags to pan. */
export type CursorMode = "text" | "hand";

export type ZoomPreset = "page-width" | "page-fit";

/** `custom` is a fixed scale; presets are re-applied whenever the viewport resizes. */
export type ZoomMode = ZoomPreset | "custom";

/** Unscaled page size in PDF points (rotation applied). */
export interface PageSize {
  readonly width: number;
  readonly height: number;
}

export interface SearchOptions {
  /** Match case exactly. Default `false`. */
  caseSensitive?: boolean | undefined;
  /** Only match whole words. Default `false`. */
  wholeWord?: boolean | undefined;
}

export type SearchStatus = "idle" | "searching" | "done";

export interface SearchMatch {
  /** 0-based page index. */
  readonly pageIndex: number;
  /** Start offset (inclusive) into the page's searchable text. */
  readonly start: number;
  /** End offset (exclusive) into the page's searchable text. */
  readonly end: number;
}

export interface SearchState {
  readonly query: string;
  readonly options: Readonly<Required<SearchOptions>>;
  readonly status: SearchStatus;
  /** Sorted by page, then by position on the page. */
  readonly matches: readonly SearchMatch[];
  /** Index into `matches`, or -1 when no match is active. */
  readonly activeIndex: number;
  /** Pages scanned so far, for progress UI on large documents. */
  readonly pagesSearched: number;
}

export interface ViewerState {
  readonly status: LoadStatus;
  readonly error: Error | null;
  readonly document: PDFDocumentProxy | null;
  readonly numPages: number;
  /** Size of every page; estimated from page 1 until the real sizes have loaded. */
  readonly pageSizes: readonly PageSize[];
  /** 1-based page currently in view. */
  readonly currentPage: number;
  /** 1 = 100% (real-world size). */
  readonly scale: number;
  readonly zoomMode: ZoomMode;
  readonly cursorMode: CursorMode;
  readonly isSidebarOpen: boolean;
  readonly isDownloading: boolean;
  readonly search: SearchState;
}
