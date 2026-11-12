"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { usePdfViewerState, usePdfViewerStore } from "../context.tsx";
import { computeListLayout, indexesIn, type ListLayout } from "../core/layout.ts";
import type { PdfViewerStore } from "../core/store.ts";
import { devicePixelRatio, releaseCanvas } from "./canvas.ts";
import { useVirtualList } from "./use-virtual-list.ts";

export interface PdfThumbnailsProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Thumbnail image width, in px. Default 120. */
  width?: number | undefined;
  /** Space between thumbnails, in px. Default 16. */
  gap?: number | undefined;
  /** How far beyond the viewport to render thumbnails, as a fraction of its height. Default 1. */
  overscan?: number | undefined;
  /** How long a thumbnail must stay in view before it renders, in ms. Default 120. */
  renderDelay?: number | undefined;
}

/** Height of the page-number label under each thumbnail, in px. */
const LABEL_HEIGHT = 20;

/** Scrollable list of page thumbnails. Click one to go to that page; follows the current page. */
export function PdfThumbnails(props: PdfThumbnailsProps): ReactNode {
  const { className, style, width = 120, gap = 16, overscan = 1, renderDelay = 120 } = props;
  const store = usePdfViewerStore();
  const doc = usePdfViewerState((state) => state.document);
  const pageSizes = usePdfViewerState((state) => state.pageSizes);
  const currentPage = usePdfViewerState((state) => state.currentPage);
  const containerRef = useRef<HTMLElement>(null);

  const layout = useMemo(() => {
    function thumbnailHeight(index: number): number {
      const page = pageSizes[index]!;
      return Math.round((width * page.height) / page.width) + LABEL_HEIGHT;
    }
    return computeListLayout(pageSizes.length, thumbnailHeight, gap);
  }, [pageSizes, width, gap]);

  const visibleThumbnails = useVirtualList(containerRef, layout, { overscan });
  useKeepInView(containerRef, layout, currentPage - 1);

  return (
    <nav
      ref={containerRef}
      className={className ? `rpv-thumbnails ${className}` : "rpv-thumbnails"}
      style={style}
      aria-label="Page thumbnails"
    >
      {/* A list with each item's position, like the pages (see PdfPages). */}
      <ol
        // Explicit role: Safari drops list semantics from lists with `list-style: none`.
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles
        role="list"
        className="rpv-thumbnails-inner"
        style={{ height: layout.totalHeight }}
      >
        {doc &&
          indexesIn(visibleThumbnails).map((pageIndex) => (
            <Thumbnail
              key={pageIndex}
              store={store}
              document={doc}
              pageIndex={pageIndex}
              pageCount={pageSizes.length}
              top={layout.tops[pageIndex]!}
              width={width}
              imageHeight={layout.heights[pageIndex]! - LABEL_HEIGHT}
              isCurrent={pageIndex === currentPage - 1}
              renderDelay={renderDelay}
            />
          ))}
      </ol>
    </nav>
  );
}

/** Scrolls the list so the given item is visible, centering it if it was off-screen. */
function useKeepInView(
  containerRef: RefObject<HTMLElement | null>,
  layout: ListLayout,
  index: number,
): void {
  useEffect(() => {
    const container = containerRef.current;
    const top = layout.tops[index];
    const height = layout.heights[index];
    if (!container || top === undefined || height === undefined) return;

    const isAboveView = top < container.scrollTop;
    const isBelowView = top + height > container.scrollTop + container.clientHeight;
    if (isAboveView || isBelowView) {
      container.scrollTop = top - (container.clientHeight - height) / 2;
    }
  }, [containerRef, layout, index]);
}

interface ThumbnailProps {
  store: PdfViewerStore;
  document: PDFDocumentProxy;
  pageIndex: number;
  pageCount: number;
  top: number;
  width: number;
  imageHeight: number;
  isCurrent: boolean;
  renderDelay: number;
}

const Thumbnail = memo(function Thumbnail(props: ThumbnailProps) {
  const { store, pageIndex, pageCount, top, width, imageHeight, isCurrent } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useThumbnailImage(props, canvasRef);

  return (
    <li
      className="rpv-thumbnail-item"
      style={{ top, width }}
      aria-posinset={pageIndex + 1}
      aria-setsize={pageCount}
    >
      <button
        type="button"
        className="rpv-thumbnail"
        aria-label={`Page ${pageIndex + 1}`}
        aria-current={isCurrent ? "page" : undefined}
        onClick={() => store.goToPage(pageIndex + 1)}
      >
        <canvas
          ref={canvasRef}
          className="rpv-thumbnail-image"
          style={{ width, height: imageHeight }}
        />
        <span className="rpv-thumbnail-label" aria-hidden="true">
          {pageIndex + 1}
        </span>
      </button>
    </li>
  );
});

/**
 * Draws the page into the thumbnail canvas: from the store's cache when it has been
 * rendered before, otherwise by rendering it (after `renderDelay`) and caching the result.
 */
function useThumbnailImage(
  props: ThumbnailProps,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): void {
  const { store, document: doc, pageIndex, width, renderDelay } = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cached = store.thumbnails.get(pageIndex, width);
    if (cached) {
      drawBitmap(canvas, cached);
      return () => releaseCanvas(canvas);
    }

    const controller = new AbortController();
    const { signal } = controller;
    let renderTask: RenderTask | undefined;

    async function renderThumbnail(target: HTMLCanvasElement): Promise<void> {
      const page = await doc.getPage(pageIndex + 1);
      signal.throwIfAborted();

      const pageWidth = page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: (width * devicePixelRatio()) / pageWidth });
      target.width = Math.max(1, Math.floor(viewport.width));
      target.height = Math.max(1, Math.floor(viewport.height));

      renderTask = page.render({ canvas: target, viewport });
      await renderTask.promise;
      signal.throwIfAborted();

      store.thumbnails.set(pageIndex, width, await createImageBitmap(target));
    }

    const timer = setTimeout(() => {
      // A cancelled or failed render just leaves the blank placeholder.
      renderThumbnail(canvas).catch(() => {});
    }, renderDelay);

    return () => {
      controller.abort();
      clearTimeout(timer);
      renderTask?.cancel();
      releaseCanvas(canvas);
    };
  }, [store, doc, pageIndex, width, renderDelay, canvasRef]);
}

function drawBitmap(canvas: HTMLCanvasElement, bitmap: ImageBitmap): void {
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
}
