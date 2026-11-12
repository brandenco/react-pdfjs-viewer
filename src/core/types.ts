import type { getDocument, PDFDocumentProxy } from "pdfjs-dist";

import type { PageGeometry } from "./page-geometry.ts";

/** Anything pdf.js can open. Binary data is copied before being handed to the worker. */
export type PdfSource = string | URL | Uint8Array | ArrayBuffer;

/** Options for pdf.js `getDocument()` (cMapUrl, password, httpHeaders, …). */
export type DocumentInitParameters = NonNullable<Parameters<typeof getDocument>[0]>;

export type LoadStatus = "idle" | "loading" | "ready" | "error";

/** The cursor modes the viewer implements: `text` selects text; `hand` drags to pan. */
export type BuiltInCursorMode = "text" | "hand";

/**
 * A built-in mode, or any other string for a mode your app implements (`"draw"`, say).
 * The viewer gives other modes no behavior of its own: it sets `data-cursor="<mode>"`
 * on the page list for styling, and you handle input in a page overlay
 * (`<PdfPages renderPageOverlay>`).
 */
export type CursorMode = BuiltInCursorMode | (string & {});

export type ZoomPreset = "page-width" | "page-fit";

/** What the sidebar shows. */
export type SidebarView = "thumbnails" | "outline";

/** `custom` is a fixed scale; presets are re-applied whenever the viewport resizes. */
export type ZoomMode = ZoomPreset | "custom";

/** Clockwise rotation of every page, in degrees, on top of the document's own. */
export type Rotation = 0 | 90 | 180 | 270;

/** Unscaled page size in PDF points (the page's own rotation and the viewer's applied). */
export interface PageSize {
  readonly width: number;
  readonly height: number;
}

export interface SearchOptions {
  /** Match case exactly. Default `false`. */
  caseSensitive?: boolean | undefined;
  /** Only match whole words. Default `false`. */
  wholeWord?: boolean | undefined;
  /**
   * Tell accented letters apart: "cafe" won't match "café". Default `false`: accents
   * are ignored, as in pdf.js' own viewer. Ligatures ("ﬁ"), full-width letters and words
   * hyphenated across lines always match their plain form.
   */
  matchDiacritics?: boolean | undefined;
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
  /**
   * Each page's view box and own rotation, for converting between PDF and on-screen
   * coordinates. Estimated from page 1 until the real ones have loaded, like `pageSizes`.
   */
  readonly pageGeometries: readonly PageGeometry[];
  /** 1-based page currently in view. */
  readonly currentPage: number;
  /** 1 = 100% (real-world size). */
  readonly scale: number;
  readonly zoomMode: ZoomMode;
  /** Extra clockwise rotation the user applied to every page. */
  readonly rotation: Rotation;
  readonly cursorMode: CursorMode;
  readonly isSidebarOpen: boolean;
  readonly sidebarView: SidebarView;
  /** Whether the search bar is shown. Closing it clears the search. */
  readonly isSearchOpen: boolean;
  readonly isDownloading: boolean;
  readonly search: SearchState;
}
