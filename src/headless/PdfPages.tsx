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

import { computeListLayout, indexesIn, itemIndexAt, type ListLayout } from "../core/layout.ts";
import { createLinkService } from "../core/link-service.ts";
import type { PagePosition } from "../core/navigation.ts";
import { PDF_TO_CSS_UNITS } from "../core/pdfjs.ts";
import type { PdfViewerStore } from "../core/store.ts";
import type { PageSize } from "../core/types.ts";
import { usePdfViewerState, usePdfViewerStore } from "./context.tsx";
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
  /**
   * Renders the annotation layer, which makes links clickable: links within the document
   * navigate, external ones open per `externalLinkTarget`. Default `true`.
   */
  annotations?: boolean | undefined;
  /** Where external links open, as an `<a target>`. Default `"_blank"`. */
  externalLinkTarget?: string | undefined;
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
    annotations = true,
    externalLinkTarget = "_blank",
    loadingFallback = <DefaultLoading />,
    errorFallback = defaultError,
  } = props;

  const store = usePdfViewerStore();
  const status = usePdfViewerState((state) => state.status);
  const error = usePdfViewerState((state) => state.error);
  const doc = usePdfViewerState((state) => state.document);
  const pageSizes = usePdfViewerState((state) => state.pageSizes);
  const scale = usePdfViewerState((state) => state.scale);
  const cursorMode = usePdfViewerState((state) => state.cursorMode);
  const rotation = usePdfViewerState((state) => state.rotation);

  const linkService = useMemo(
    () => (annotations ? createLinkService(store, { externalLinkTarget }) : null),
    [store, annotations, externalLinkTarget],
  );

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

  const scrollAnchor = useScrollAnchor(
    containerRef,
    doc,
    layout,
    (pageIndex) => (pageSizes[pageIndex]?.width ?? 0) * cssScale,
  );
  const visiblePages = useVirtualList(containerRef, layout, {
    overscan,
    onLayoutChange(_previous, next) {
      scrollAnchor.onLayoutChange(next);
    },
    onScroll(container, currentLayout) {
      const jumpedTo = scrollAnchor.jumpedToPage();
      store.reportCurrentPage(jumpedTo ?? currentPageAt(container, currentLayout));
    },
    onResize() {
      store.reportViewportResize();
    },
  });
  usePageScroller(containerRef, layout, store, scrollAnchor);
  usePinchZoom(containerRef, store, scrollAnchor);
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
              rotation={rotation}
              top={layout.tops[pageIndex]!}
              width={pageSizes[pageIndex]!.width * cssScale}
              height={layout.heights[pageIndex]!}
              renderDelay={renderDelay}
              maxCanvasPixels={maxCanvasPixels}
              linkService={linkService}
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
  /**
   * Remembers the point at this viewport position (px from the container's top-left;
   * `null` x means the center), to keep it in place through the next layout change.
   */
  saveAt: (offsetX: number | null, offsetY: number) => void;
  /** Scrolls back to the remembered spot after page heights changed (zoom, page sizes). */
  onLayoutChange: (layout: ListLayout) => void;
  /**
   * Scrolls to a page, or a position on it. If the layout doesn't include that page yet
   * (a document that is still being laid out), it's applied on the next layout change.
   */
  scrollToPage: (pageIndex: number, position?: PagePosition) => void;
  /**
   * The 1-based page last navigated to, until the user scrolls themselves. A link target
   * near the bottom of a page shows mostly the next page, but the user went to this one.
   */
  jumpedToPage: () => number | null;
}

/** How much space to leave above a link or outline target, in px. */
const TARGET_MARGIN = 8;

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
  pageWidth: (pageIndex: number) => number,
): ScrollAnchor {
  // Fractions rather than pixels, so they survive a change of scale.
  // `offsetX` / `offsetY`: where in the viewport the anchored point is (the top center
  // while scrolling, the pointer while zooming with the wheel).
  const anchor = useRef<{
    pageIndex: number;
    fractionDown: number;
    offsetY: number;
    fractionX: number;
    offsetX: number;
  }>(null);
  const pending = useRef<{ pageIndex: number; position: PagePosition | undefined }>(null);
  const jumpedTo = useRef<number | null>(null);
  const layoutRef = useRef(layout);
  const pageWidthRef = useRef(pageWidth);
  useLayoutEffect(() => {
    pageWidthRef.current = pageWidth;
  });

  // A new document starts at the top. This runs before useVirtualList's layout effect,
  // so a previous document's anchor is never applied to the new one. A pending target
  // stays: it was set for the new document (its initial page, say).
  useLayoutEffect(() => {
    anchor.current = null;
    jumpedTo.current = null;
    containerRef.current?.scrollTo(0, 0);
    // `doc` isn't read here; a new document is what triggers the reset.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [containerRef, doc]);

  const scrollAnchor = useMemo<ScrollAnchor>(() => {
    function saveAt(offsetX: number | null, offsetY: number): void {
      const container = containerRef.current;
      const current = layoutRef.current;
      if (!container || current.count === 0) return;

      const x = offsetX ?? container.clientWidth / 2;
      const y = container.scrollTop + offsetY;
      const pageIndex = itemIndexAt(current, y);
      const pageTop = current.tops[pageIndex]!;
      const pageSpan = current.heights[pageIndex]! + current.gap;
      anchor.current = {
        pageIndex,
        fractionDown: (y - pageTop) / pageSpan,
        offsetY,
        fractionX: (container.scrollLeft + x) / container.scrollWidth,
        offsetX: x,
      };
    }

    function save(): void {
      saveAt(null, 0);
    }

    /** Scrolls if the page is laid out; returns whether it was. */
    function applyTarget(pageIndex: number, position: PagePosition | undefined): boolean {
      const container = containerRef.current;
      const { tops, heights, gap } = layoutRef.current;
      const pageTop = tops[pageIndex];
      const pageHeight = heights[pageIndex];
      if (!container || pageTop === undefined || pageHeight === undefined) return false;

      container.scrollTop =
        position?.top === undefined
          ? pageTop - gap / 2
          : pageTop + position.top * pageHeight - TARGET_MARGIN;

      if (position?.left !== undefined) {
        // Pages are centered in a list at least as wide as the viewport (and as the
        // widest page). A page that fits is shown whole; only a wider one is scrolled
        // to put the target at the left edge.
        const width = pageWidthRef.current(pageIndex);
        const pageLeft = (container.scrollWidth - width) / 2;
        container.scrollLeft =
          width <= container.clientWidth
            ? pageLeft - (container.clientWidth - width) / 2
            : pageLeft + position.left * width - TARGET_MARGIN;
      }
      jumpedTo.current = pageIndex + 1;
      save(); // before any layout change can restore the old position
      return true;
    }

    function scrollToPage(pageIndex: number, position?: PagePosition): void {
      pending.current = applyTarget(pageIndex, position) ? null : { pageIndex, position };
    }

    function onLayoutChange(next: ListLayout): void {
      layoutRef.current = next;
      const container = containerRef.current;
      if (!container || next.count === 0) return;

      const target = pending.current;
      if (target && applyTarget(target.pageIndex, target.position)) {
        pending.current = null;
        return;
      }

      const saved = anchor.current;
      if (!saved) return;
      const pageIndex = Math.min(saved.pageIndex, next.count - 1);
      const pageSpan = next.heights[pageIndex]! + next.gap;
      container.scrollTop = next.tops[pageIndex]! + saved.fractionDown * pageSpan - saved.offsetY;
      container.scrollLeft = saved.fractionX * container.scrollWidth - saved.offsetX;
    }

    return {
      save,
      saveAt,
      onLayoutChange,
      scrollToPage,
      jumpedToPage: () => jumpedTo.current,
    };
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scrolling the user does themselves starts with one of these. Programmatic scrolls
    // (navigation, keeping the anchor while pages resize) don't, and keep the jump.
    function onUserScrollIntent(): void {
      jumpedTo.current = null;
    }
    const userEvents = ["wheel", "keydown", "pointerdown", "touchstart"] as const;
    for (const type of userEvents) {
      container.addEventListener(type, onUserScrollIntent, { passive: true });
    }
    container.addEventListener("scroll", scrollAnchor.save, { passive: true });
    return () => {
      for (const type of userEvents) container.removeEventListener(type, onUserScrollIntent);
      container.removeEventListener("scroll", scrollAnchor.save);
    };
  }, [containerRef, scrollAnchor]);

  return scrollAnchor;
}

/** Lets the store scroll this container: page navigation, search results, fit-to-page zoom. */
function usePageScroller(
  containerRef: RefObject<HTMLElement | null>,
  layout: ListLayout,
  store: PdfViewerStore,
  scrollAnchor: ScrollAnchor,
): void {
  const gapRef = useRef(layout.gap);
  useEffect(() => {
    gapRef.current = layout.gap;
  }, [layout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    return store.attachScroller({
      scrollToPage: scrollAnchor.scrollToPage,
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
      getPagePadding: () => gapRef.current,
    });
  }, [containerRef, store, scrollAnchor]);
}

/** Pixels of wheel movement that zoom by a factor of e. Smaller zooms faster. */
const WHEEL_ZOOM_SPEED = 100;

/** Safari's trackpad pinch events. Not in the DOM typings, since only Safari has them. */
interface GestureEvent extends MouseEvent {
  readonly scale: number;
}

function isGestureEvent(event: Event): event is GestureEvent {
  return "scale" in event && typeof event.scale === "number" && "clientX" in event;
}

/**
 * Ctrl/Cmd + wheel and trackpad pinch zoom the pages (instead of the whole web page),
 * keeping the point under the pointer in place. Chrome, Edge and Firefox report pinches
 * as Ctrl + wheel; Safari as gesture events.
 */
function usePinchZoom(
  containerRef: RefObject<HTMLElement | null>,
  store: PdfViewerStore,
  scrollAnchor: ScrollAnchor,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function zoomAround(clientX: number, clientY: number, scale: number): void {
      const rect = container!.getBoundingClientRect();
      scrollAnchor.saveAt(clientX - rect.left, clientY - rect.top);
      store.setScale(scale);
    }

    function onWheel(event: WheelEvent): void {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); // don't zoom the whole page
      const lineHeight = 16;
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * lineHeight
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * container!.clientHeight
            : event.deltaY;
      const factor = Math.exp(-pixels / WHEEL_ZOOM_SPEED);
      zoomAround(event.clientX, event.clientY, store.getState().scale * factor);
    }

    let gestureStartScale = 1;
    function onGestureStart(event: Event): void {
      event.preventDefault();
      gestureStartScale = store.getState().scale;
    }
    function onGestureChange(event: Event): void {
      if (!isGestureEvent(event)) return;
      event.preventDefault();
      zoomAround(event.clientX, event.clientY, gestureStartScale * event.scale);
    }

    // Not passive: these cancel the browser's own zoom.
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("gesturestart", onGestureStart);
    container.addEventListener("gesturechange", onGestureChange);
    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("gesturestart", onGestureStart);
      container.removeEventListener("gesturechange", onGestureChange);
    };
  }, [containerRef, store, scrollAnchor]);
}
