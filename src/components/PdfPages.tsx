"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { usePdfViewerState, usePdfViewerStore } from "../context.tsx";
import { computeListLayout, indexesIn, itemIndexAt, type ListLayout } from "../core/layout.ts";
import { PDF_TO_CSS_UNITS } from "../core/pdfjs.ts";
import { storeInternals, type StoreInternals } from "../core/store.ts";
import type { PageSize } from "../core/types.ts";
import { PdfPage } from "./PdfPage.tsx";
import { useHandPan } from "./use-hand-pan.ts";
import { useVirtualList } from "./use-virtual-list.ts";

export interface PdfPagesProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Space between (and around) pages, in px. Default 16. */
  gap?: number | undefined;
  /** How far beyond the viewport to render pages, as a fraction of its height. Default 0.5. */
  overscan?: number | undefined;
  /** How long a page must stay in view before it renders, in ms. Default 60. */
  renderDelay?: number | undefined;
  /** Maximum pixels per page canvas. Default 4096 × 4096. */
  maxCanvasPixels?: number | undefined;
  /** Shown while the document loads. Default: a "Loading document…" status message. */
  loadingFallback?: ReactNode | undefined;
  /** Shown when the document fails to load. Default: an alert with the error message. */
  errorFallback?: ((error: Error) => ReactNode) | undefined;
}

/** The scrollable page list. Only pages near the viewport are mounted. */
export function PdfPages(props: PdfPagesProps): ReactNode {
  const {
    className,
    style,
    gap = 16,
    overscan = 0.5,
    renderDelay = 60,
    maxCanvasPixels = 4096 * 4096,
    loadingFallback = <DefaultLoading />,
    errorFallback = defaultError,
  } = props;

  const store = usePdfViewerStore();
  const internals = useMemo(() => storeInternals(store), [store]);
  const status = usePdfViewerState((state) => state.status);
  const error = usePdfViewerState((state) => state.error);
  const doc = usePdfViewerState((state) => state.document);
  const pageSizes = usePdfViewerState((state) => state.pageSizes);
  const scale = usePdfViewerState((state) => state.scale);
  const cursorMode = usePdfViewerState((state) => state.cursorMode);

  const containerRef = useRef<HTMLElement>(null);
  const cssScale = scale * PDF_TO_CSS_UNITS;
  const layout = useMemo(
    () => computeListLayout(pageSizes.length, (index) => pageSizes[index]!.height * cssScale, gap),
    [pageSizes, cssScale, gap],
  );
  const contentWidth = useMemo(
    () => widestPage(pageSizes) * cssScale + gap * 2,
    [pageSizes, cssScale, gap],
  );

  const scrollAnchor = useScrollAnchor(containerRef, doc, layout);
  const visiblePages = useVirtualList(containerRef, layout, {
    overscan,
    onLayoutChange(_previous, next) {
      scrollAnchor.onLayoutChange(next);
    },
    onScroll(container, currentLayout) {
      internals.setCurrentPage(currentPageAt(container, currentLayout));
    },
    onResize() {
      internals.onViewportResize();
    },
  });
  usePageScroller(containerRef, layout, internals, scrollAnchor);
  const panHandlers = useHandPan(cursorMode === "hand");

  return (
    <section
      ref={containerRef}
      aria-label="Document"
      aria-busy={status === "loading"}
      className={className ? `rpv-pages ${className}` : "rpv-pages"}
      style={style}
      data-cursor={cursorMode}
      // Scrollable regions must be focusable so the keyboard can scroll them.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      {...panHandlers}
    >
      {status === "loading" && loadingFallback}
      {status === "error" && error && errorFallback(error)}
      {doc && (
        // A list, so screen readers announce each page's position ("Page 99, 99 of 5000")
        // even though only the pages near the viewport exist in the DOM.
        <ul
          // Explicit role: Safari drops list semantics from lists with `list-style: none`.
          // oxlint-disable-next-line jsx-a11y/no-redundant-roles
          role="list"
          className="rpv-pages-inner"
          style={{ height: layout.totalHeight, width: contentWidth }}
        >
          {indexesIn(visiblePages).map((pageIndex) => (
            <PdfPage
              key={pageIndex}
              document={doc}
              pageIndex={pageIndex}
              pageCount={pageSizes.length}
              cssScale={cssScale}
              top={layout.tops[pageIndex]!}
              width={pageSizes[pageIndex]!.width * cssScale}
              height={layout.heights[pageIndex]!}
              renderDelay={renderDelay}
              maxCanvasPixels={maxCanvasPixels}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DefaultLoading(): ReactNode {
  return (
    // <output> is a polite status region, so screen readers announce the message.
    <output className="rpv-status">Loading document…</output>
  );
}

function defaultError(error: Error): ReactNode {
  return (
    <p className="rpv-status" role="alert">
      This document couldn’t be opened. {error.message}
    </p>
  );
}

function widestPage(pageSizes: readonly PageSize[]): number {
  let widest = 0;
  for (const size of pageSizes) widest = Math.max(widest, size.width);
  return widest;
}

/**
 * The page the user is reading: the one a third of the way down the viewport, or the
 * last page once scrolled to the very bottom (short last pages never reach that line).
 */
function currentPageAt(container: HTMLElement, layout: ListLayout): number {
  const { scrollTop, clientHeight, scrollHeight } = container;
  const isAtBottom = scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 2;
  if (isAtBottom) return layout.count;
  return itemIndexAt(layout, scrollTop + clientHeight * 0.35) + 1;
}

// Plain functions (closures), so they can be passed around, e.g. as event listeners.
interface ScrollAnchor {
  /** Remembers the current scroll position. Call right after scrolling programmatically. */
  save: () => void;
  /** Scrolls back to the remembered spot after page heights changed (zoom, page sizes). */
  onLayoutChange: (layout: ListLayout) => void;
}

/**
 * Keeps the user's place when page heights change, by remembering which spot of which
 * page is at the top of the viewport. Resets to the top for a new document.
 *
 * The position is saved on every scroll event, not once per frame: page sizes stream in
 * while a large document opens, and a layout change landing between a scroll and the
 * next frame would otherwise restore a stale position (undoing a page jump, say).
 */
function useScrollAnchor(
  containerRef: RefObject<HTMLElement | null>,
  doc: PDFDocumentProxy | null,
  layout: ListLayout,
): ScrollAnchor {
  // Fractions rather than pixels, so they survive a change of scale.
  const anchor = useRef<{ pageIndex: number; fractionDown: number; centerX: number }>(null);
  const layoutRef = useRef(layout);

  // A new document starts at the top. This runs before useVirtualList's layout effect,
  // so a previous document's anchor is never applied to the new one.
  useLayoutEffect(() => {
    anchor.current = null;
    containerRef.current?.scrollTo(0, 0);
    // `doc` isn't read here; a new document is what triggers the reset.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [containerRef, doc]);

  const scrollAnchor = useMemo<ScrollAnchor>(() => {
    function save(): void {
      const container = containerRef.current;
      const current = layoutRef.current;
      if (!container || current.count === 0) return;

      const pageIndex = itemIndexAt(current, container.scrollTop);
      const pageTop = current.tops[pageIndex]!;
      const pageSpan = current.heights[pageIndex]! + current.gap;
      anchor.current = {
        pageIndex,
        fractionDown: (container.scrollTop - pageTop) / pageSpan,
        centerX: (container.scrollLeft + container.clientWidth / 2) / container.scrollWidth,
      };
    }

    function onLayoutChange(next: ListLayout): void {
      layoutRef.current = next;
      const container = containerRef.current;
      const saved = anchor.current;
      if (!container || !saved || next.count === 0) return;

      const pageIndex = Math.min(saved.pageIndex, next.count - 1);
      const pageSpan = next.heights[pageIndex]! + next.gap;
      container.scrollTop = next.tops[pageIndex]! + saved.fractionDown * pageSpan;
      container.scrollLeft = saved.centerX * container.scrollWidth - container.clientWidth / 2;
    }

    return { save, onLayoutChange };
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    container?.addEventListener("scroll", scrollAnchor.save, { passive: true });
    return () => container?.removeEventListener("scroll", scrollAnchor.save);
  }, [containerRef, scrollAnchor]);

  return scrollAnchor;
}

/** Lets the store scroll this container: page navigation, search results, fit-to-page zoom. */
function usePageScroller(
  containerRef: RefObject<HTMLElement | null>,
  layout: ListLayout,
  internals: StoreInternals,
  scrollAnchor: ScrollAnchor,
): void {
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    internals.setScroller({
      scrollToPage(pageIndex) {
        const { tops, gap } = layoutRef.current;
        const pageTop = tops[pageIndex];
        if (pageTop === undefined) return;
        container.scrollTop = pageTop - gap / 2;
        scrollAnchor.save(); // before any layout change can restore the old position
      },
      scrollToRect(target) {
        const viewport = container.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        if (rect.top < viewport.top || rect.bottom > viewport.bottom) {
          // Put the target a third of the way down, where the eye naturally lands.
          container.scrollTop += rect.top - viewport.top - viewport.height / 3;
        }
        if (rect.left < viewport.left || rect.right > viewport.right) {
          container.scrollLeft += rect.left - viewport.left - (viewport.width - rect.width) / 2;
        }
        scrollAnchor.save();
      },
      getViewportSize: () => ({ width: container.clientWidth, height: container.clientHeight }),
      getPagePadding: () => layoutRef.current.gap,
    });
    return () => internals.setScroller(null);
  }, [containerRef, internals, scrollAnchor]);
}
