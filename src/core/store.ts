import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { filenameFromSource, getPageSize, readPageSizes, toInitSource } from "./document.ts";
import { saveAsFile } from "./download.ts";
import { loadPdfjs } from "./pdfjs.ts";
import { buildSearchRegExp, pickFirstActiveMatch, scanPages } from "./search.ts";
import { extractPageText, type PageText } from "./text.ts";
import { ThumbnailCache } from "./thumbnail-cache.ts";
import type {
  CursorMode,
  DocumentInitParameters,
  PageSize,
  PdfSource,
  SearchMatch,
  SearchOptions,
  SearchState,
  ViewerState,
  ZoomMode,
  ZoomPreset,
} from "./types.ts";
import { clamp, fitScale, nextZoomStep, previousZoomStep } from "./zoom.ts";

export interface StoreOptions {
  /** A scale (1 = 100%) or a fit preset. Default `"page-fit"`. */
  initialScale?: number | ZoomPreset | undefined;
  /** Default `false`. */
  initialSidebarOpen?: boolean | undefined;
  /** Default `"text"`. */
  initialCursorMode?: CursorMode | undefined;
  /** Default 0.25. */
  minScale?: number | undefined;
  /** Default 5. */
  maxScale?: number | undefined;
  /** How many rendered thumbnails to keep in memory. Default 200. */
  thumbnailCacheSize?: number | undefined;
}

/** One call to `load()`: lets its cleanup cancel exactly that load. */
interface LoadAttempt {
  readonly controller: AbortController;
  loadingTask: PDFDocumentLoadingTask | null;
}

/** Implemented by `<PdfPages>`, which owns the scroll container. */
export interface PageScroller {
  scrollToPage(pageIndex: number): void;
  /** Scrolls a rendered element or text range into view. */
  scrollToRect(target: { getBoundingClientRect(): DOMRect }): void;
  getViewportSize(): { width: number; height: number };
  /** Space around each page, in px. */
  getPagePadding(): number;
}

/** Store methods used by the library's own components. Not exported from the package. */
export interface StoreInternals {
  setScroller(scroller: PageScroller | null): void;
  /** Re-fits the page when a zoom preset is active. */
  onViewportResize(): void;
  /** Reported by `<PdfPages>` as the user scrolls. */
  setCurrentPage(pageNumber: number): void;
  /** Whether a freshly rendered highlight for `match` should be scrolled into view. */
  takeMatchToReveal(match: SearchMatch): boolean;
  scrollIntoView(target: { getBoundingClientRect(): DOMRect }): void;
}

const EMPTY_SEARCH: SearchState = {
  query: "",
  options: { caseSensitive: false, wholeWord: false },
  status: "idle",
  matches: [],
  activeIndex: -1,
  pagesSearched: 0,
};

// Assigned by the class's `static` block below. Declared first because that block runs
// while the class is being defined.
let getInternals: (store: PdfViewerStore) => StoreInternals;

/** The library's own components use this to reach the store's private methods. */
export function storeInternals(store: PdfViewerStore): StoreInternals {
  return getInternals(store);
}

/**
 * All viewer state and actions. Components read state through `useSyncExternalStore`
 * and call actions through the hooks in `hooks.ts`.
 */
export class PdfViewerStore {
  readonly minScale: number;
  readonly maxScale: number;
  /** Rendered thumbnails, shared by every `<PdfThumbnails>` of this viewer. */
  readonly thumbnails: ThumbnailCache;

  #state: ViewerState;
  readonly #listeners = new Set<() => void>();
  readonly #initialZoom: { scale: number; zoomMode: ZoomMode };

  #scroller: PageScroller | null = null;
  #pageTextCache = new Map<number, Promise<PageText>>();
  #currentLoad: LoadAttempt | null = null;
  #searchController: AbortController | null = null;
  /** The match the next rendered highlight should scroll into view. */
  #matchToReveal: SearchMatch | null = null;
  #filename: string | undefined;
  #sourceFilename: string | undefined;

  constructor(options: StoreOptions = {}) {
    this.minScale = options.minScale ?? 0.25;
    this.maxScale = options.maxScale ?? 5;
    this.thumbnails = new ThumbnailCache(options.thumbnailCacheSize ?? 200);

    const initialScale = options.initialScale ?? "page-fit";
    this.#initialZoom =
      typeof initialScale === "number"
        ? { scale: initialScale, zoomMode: "custom" }
        : { scale: 1, zoomMode: initialScale };

    this.#state = {
      status: "idle",
      error: null,
      document: null,
      numPages: 0,
      pageSizes: [],
      currentPage: 1,
      ...this.#initialZoom,
      cursorMode: options.initialCursorMode ?? "text",
      isSidebarOpen: options.initialSidebarOpen ?? false,
      isDownloading: false,
      search: EMPTY_SEARCH,
    };
  }

  // ---------------------------------------------------------------------------
  // State subscription (for useSyncExternalStore)
  // ---------------------------------------------------------------------------

  getState(): ViewerState {
    return this.#state;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #update(changes: Partial<ViewerState>): void {
    this.#state = { ...this.#state, ...changes };
    for (const listener of this.#listeners) listener();
  }

  #updateSearch(changes: Partial<SearchState>): void {
    this.#update({ search: { ...this.#state.search, ...changes } });
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  /** Loads a document. Returns a function that cancels the load / closes the document. */
  load(
    source: PdfSource,
    options: Omit<DocumentInitParameters, "url" | "data"> = {},
    workerSrc?: string,
  ): () => void {
    this.#reset();
    this.#sourceFilename = filenameFromSource(source);

    const attempt: LoadAttempt = { controller: new AbortController(), loadingTask: null };
    this.#currentLoad = attempt;
    this.#update({ status: "loading" });

    this.#open(source, options, workerSrc, attempt).catch((error: unknown) => {
      if (attempt.controller.signal.aborted) return;
      this.#update({ status: "error", error: toError(error) });
    });

    return () => {
      attempt.controller.abort();
      if (this.#currentLoad === attempt) this.#reset();
      void attempt.loadingTask?.destroy();
    };
  }

  async #open(
    source: PdfSource,
    options: Omit<DocumentInitParameters, "url" | "data">,
    workerSrc: string | undefined,
    attempt: LoadAttempt,
  ): Promise<void> {
    const { signal } = attempt.controller;
    const pdfjs = await loadPdfjs();
    signal.throwIfAborted();

    if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    attempt.loadingTask = pdfjs.getDocument({ ...options, ...toInitSource(source) });
    const doc = await attempt.loadingTask.promise;
    signal.throwIfAborted();

    await this.#showDocument(doc, signal);
  }

  async #showDocument(doc: PDFDocumentProxy, signal: AbortSignal): Promise<void> {
    // Show the document right away, assuming every page is the size of page 1.
    // The real sizes are filled in below without blocking.
    const firstPageSize = getPageSize(await doc.getPage(1));
    signal.throwIfAborted();

    this.#update({
      status: "ready",
      document: doc,
      numPages: doc.numPages,
      pageSizes: Array.from({ length: doc.numPages }, () => firstPageSize),
      currentPage: 1,
    });
    this.#applyZoomPreset();

    for await (const batch of readPageSizes(doc)) {
      if (signal.aborted) return;
      this.#updatePageSizes(batch);
    }
  }

  #updatePageSizes(sizes: [pageIndex: number, size: PageSize][]): void {
    let pageSizes: PageSize[] | null = null;
    for (const [pageIndex, size] of sizes) {
      const current = this.#state.pageSizes[pageIndex];
      if (current?.width === size.width && current.height === size.height) continue;

      pageSizes ??= [...this.#state.pageSizes]; // copy only if something changed
      pageSizes[pageIndex] = size;
    }
    if (pageSizes) this.#update({ pageSizes });
  }

  /** Back to "no document". Cursor mode and the sidebar are user preferences, so they stay. */
  #reset(): void {
    this.#currentLoad?.controller.abort();
    this.#currentLoad = null;
    this.#searchController?.abort();
    this.#searchController = null;
    this.#pageTextCache = new Map();
    this.#matchToReveal = null;
    this.thumbnails.clear();

    this.#update({
      status: "idle",
      error: null,
      document: null,
      numPages: 0,
      pageSizes: [],
      currentPage: 1,
      ...this.#initialZoom,
      search: EMPTY_SEARCH,
    });
  }

  // ---------------------------------------------------------------------------
  // Page navigation
  // ---------------------------------------------------------------------------

  /** Scrolls to a 1-based page number (clamped to the document). */
  goToPage(pageNumber: number): void {
    const { numPages } = this.#state;
    if (numPages === 0) return;

    const page = clamp(Math.round(pageNumber), 1, numPages);
    this.#scroller?.scrollToPage(page - 1);
    this.#setCurrentPage(page);
  }

  nextPage(): void {
    this.goToPage(this.#state.currentPage + 1);
  }

  previousPage(): void {
    this.goToPage(this.#state.currentPage - 1);
  }

  firstPage(): void {
    this.goToPage(1);
  }

  lastPage(): void {
    this.goToPage(this.#state.numPages);
  }

  #setCurrentPage(pageNumber: number): void {
    if (pageNumber !== this.#state.currentPage) this.#update({ currentPage: pageNumber });
  }

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  /** Sets a fixed scale (1 = 100%). */
  setScale(scale: number): void {
    this.#setScale(scale, "custom");
  }

  zoomIn(): void {
    this.setScale(nextZoomStep(this.#state.scale) ?? this.maxScale);
  }

  zoomOut(): void {
    this.setScale(previousZoomStep(this.#state.scale) ?? this.minScale);
  }

  /** Fits the current page to the viewport, and keeps it fitted as the viewport resizes. */
  zoomTo(preset: ZoomPreset): void {
    this.#update({ zoomMode: preset });
    this.#applyZoomPreset();
  }

  #setScale(scale: number, zoomMode: ZoomMode): void {
    const clamped = clamp(scale, this.minScale, this.maxScale);
    if (clamped !== this.#state.scale || zoomMode !== this.#state.zoomMode) {
      this.#update({ scale: clamped, zoomMode });
    }
  }

  /** Recomputes the scale for a fit preset. Runs on load, on resize and when a preset is picked. */
  #applyZoomPreset(): void {
    const { zoomMode, pageSizes, currentPage } = this.#state;
    const page = pageSizes[currentPage - 1];
    const viewport = this.#scroller?.getViewportSize();
    if (zoomMode === "custom" || !page || !viewport) return;
    if (viewport.width <= 0 || viewport.height <= 0) return; // not laid out yet

    const padding = this.#scroller?.getPagePadding() ?? 0;
    this.#setScale(fitScale(zoomMode, page, viewport, padding), zoomMode);
  }

  // ---------------------------------------------------------------------------
  // Cursor mode, sidebar, download
  // ---------------------------------------------------------------------------

  setCursorMode(mode: CursorMode): void {
    if (mode !== this.#state.cursorMode) this.#update({ cursorMode: mode });
  }

  toggleCursorMode(): void {
    this.setCursorMode(this.#state.cursorMode === "text" ? "hand" : "text");
  }

  setSidebarOpen(isOpen: boolean): void {
    if (isOpen !== this.#state.isSidebarOpen) this.#update({ isSidebarOpen: isOpen });
  }

  toggleSidebar(): void {
    this.setSidebarOpen(!this.#state.isSidebarOpen);
  }

  /** Default `download()` filename. When unset, the URL's filename is used if it has one. */
  setFilename(filename: string | undefined): void {
    this.#filename = filename;
  }

  /** Saves the original PDF bytes. */
  async download(filename?: string): Promise<void> {
    const doc = this.#state.document;
    if (!doc || this.#state.isDownloading) return;

    this.#update({ isDownloading: true });
    try {
      const bytes = await doc.getData();
      saveAsFile(bytes, filename ?? this.#filename ?? this.#sourceFilename ?? "document.pdf");
    } finally {
      this.#update({ isDownloading: false });
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /** Starts (or restarts) a search. Results stream into `search.matches` as pages are scanned. */
  async search(query: string, options: SearchOptions = {}): Promise<void> {
    this.#searchController?.abort();
    const controller = new AbortController();
    this.#searchController = controller;
    this.#matchToReveal = null;

    const resolvedOptions = {
      caseSensitive: options.caseSensitive ?? false,
      wholeWord: options.wholeWord ?? false,
    };
    const regex = buildSearchRegExp(query, resolvedOptions);
    const doc = this.#state.document;
    if (!regex || !doc) {
      this.#update({ search: { ...EMPTY_SEARCH, query, options: resolvedOptions } });
      return;
    }

    this.#update({
      search: { ...EMPTY_SEARCH, query, options: resolvedOptions, status: "searching" },
    });

    const currentPageIndex = this.#state.currentPage - 1;
    const getPageText = (pageIndex: number): Promise<PageText> => this.getPageText(pageIndex);
    for await (const progress of scanPages(doc.numPages, getPageText, regex, controller.signal)) {
      const matches = [...this.#state.search.matches, ...progress.newMatches];
      const hasActiveMatch = this.#state.search.activeIndex !== -1;

      this.#updateSearch({
        matches,
        pagesSearched: progress.pagesSearched,
        status: progress.isComplete ? "done" : "searching",
      });

      if (!hasActiveMatch) {
        const first = pickFirstActiveMatch(matches, currentPageIndex, progress.isComplete);
        if (first !== -1) this.setActiveMatch(first);
      }
    }
  }

  clearSearch(): void {
    this.#searchController?.abort();
    this.#matchToReveal = null;
    this.#update({ search: EMPTY_SEARCH });
  }

  nextMatch(): void {
    this.#stepActiveMatch(1);
  }

  previousMatch(): void {
    this.#stepActiveMatch(-1);
  }

  /** Makes a match active and scrolls it into view. */
  setActiveMatch(index: number): void {
    const match = this.#state.search.matches[index];
    if (!match) return;

    this.#updateSearch({ activeIndex: index });
    this.#matchToReveal = match;
    this.goToPage(match.pageIndex + 1);
  }

  #stepActiveMatch(direction: 1 | -1): void {
    const { matches, activeIndex } = this.#state.search;
    if (matches.length === 0) return;

    // With nothing active yet, "next" starts at the first match and "previous" at the last.
    const from = activeIndex === -1 ? (direction === 1 ? -1 : 0) : activeIndex;
    const to = (from + direction + matches.length) % matches.length;
    this.setActiveMatch(to);
  }

  /** The searchable text of a page (0-based), extracted once and cached. */
  getPageText(pageIndex: number): Promise<PageText> {
    const doc = this.#state.document;
    if (!doc) return Promise.reject(new Error("No document loaded"));

    let pageText = this.#pageTextCache.get(pageIndex);
    if (!pageText) {
      pageText = doc.getPage(pageIndex + 1).then(extractPageText);
      pageText.catch(() => this.#pageTextCache.delete(pageIndex)); // allow a retry
      this.#pageTextCache.set(pageIndex, pageText);
    }
    return pageText;
  }

  // ---------------------------------------------------------------------------
  // Internals used by the library's own components (see `storeInternals`)
  // ---------------------------------------------------------------------------

  #setScroller(scroller: PageScroller | null): void {
    this.#scroller = scroller;
    this.#applyZoomPreset();
  }

  /** True exactly once for the match that `setActiveMatch` asked to scroll to. */
  #takeMatchToReveal(match: SearchMatch): boolean {
    if (this.#matchToReveal !== match) return false;
    this.#matchToReveal = null;
    return true;
  }

  #scrollIntoView(target: { getBoundingClientRect(): DOMRect }): void {
    this.#scroller?.scrollToRect(target);
  }

  static {
    // A static block can reach `#private` members. This gives the library's components
    // access to them without making them part of the public class.
    getInternals = (store) => ({
      setScroller: (scroller) => store.#setScroller(scroller),
      onViewportResize: () => store.#applyZoomPreset(),
      setCurrentPage: (pageNumber) => store.#setCurrentPage(pageNumber),
      takeMatchToReveal: (match) => store.#takeMatchToReveal(match),
      scrollIntoView: (target) => store.#scrollIntoView(target),
    });
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
