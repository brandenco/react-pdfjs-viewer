"use client";

import type {
  PDFDocumentProxy,
  PDFPageProxy,
  PageViewport,
  RenderTask,
  TextLayer,
} from "pdfjs-dist";
import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { loadPdfjs, type Pdfjs } from "../core/pdfjs.ts";
import { TEXT_CONTENT_OPTIONS } from "../core/text.ts";
import { createPageCanvas, isCancellation, releaseCanvas, releaseCanvasesIn } from "./canvas.ts";
import { useSearchHighlights } from "./use-search-highlights.ts";

export interface PdfPageProps {
  document: PDFDocumentProxy;
  pageIndex: number;
  /** Total number of pages, for screen readers (`aria-setsize`). */
  pageCount: number;
  /** The pdf.js viewport scale: the user's zoom × PDF-to-CSS units. */
  cssScale: number;
  /** Position and size in the scroll container, in px. */
  top: number;
  width: number;
  height: number;
  renderDelay: number;
  maxCanvasPixels: number;
}

/** One page: a canvas, a selectable text layer on top, and search highlights. */
export const PdfPage: (props: PdfPageProps) => ReactNode = memo(function PdfPage(props) {
  const { document: doc, pageIndex, pageCount, cssScale, top, width, height } = props;
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const textHostRef = useRef<HTMLDivElement>(null);

  const textLayer = useRenderedPage(props, canvasHostRef, textHostRef);
  useSearchHighlights(pageIndex, textLayer);
  useReleaseResourcesOnUnmount(doc, pageIndex, canvasHostRef);

  // pdf.js sizes the text layer from `--total-scale-factor`.
  const style = { top, width, height, "--total-scale-factor": cssScale } as CSSProperties;

  return (
    <li
      className="rpv-page"
      style={style}
      data-page-number={pageIndex + 1}
      aria-label={`Page ${pageIndex + 1}`}
      aria-posinset={pageIndex + 1}
      aria-setsize={pageCount}
    >
      {/* The canvas is a picture of the text layer above it; keep it out of the a11y tree. */}
      <div ref={canvasHostRef} className="rpv-page-canvas" aria-hidden="true" />
      <div ref={textHostRef} className="rpv-page-text" />
    </li>
  );
});

/**
 * Renders the page's canvas and text layer, and re-renders them when the scale changes.
 *
 * Rendering waits `renderDelay` ms, so pages that only fly past during fast scrolling,
 * and the in-between steps of a zoom, never reach the pdf.js worker. The old canvas
 * stays on screen (stretched) until the new one is ready, so zooming never flashes blank.
 *
 * Returns the current text layer once it has rendered.
 */
function useRenderedPage(
  props: PdfPageProps,
  canvasHostRef: RefObject<HTMLDivElement | null>,
  textHostRef: RefObject<HTMLDivElement | null>,
): TextLayer | null {
  const { document: doc, pageIndex, cssScale, renderDelay, maxCanvasPixels } = props;
  const [textLayer, setTextLayer] = useState<TextLayer | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let renderTask: RenderTask | undefined;
    let pendingTextLayer: TextLayer | undefined;
    let pendingCanvas: HTMLCanvasElement | undefined;

    async function renderPage(): Promise<void> {
      const [pdfjs, page] = await Promise.all([loadPdfjs(), doc.getPage(pageIndex + 1)]);
      signal.throwIfAborted();

      const viewport = page.getViewport({ scale: cssScale });
      await Promise.all([renderCanvas(page, viewport), renderTextLayer(pdfjs, page, viewport)]);
    }

    async function renderCanvas(page: PDFPageProxy, viewport: PageViewport): Promise<void> {
      const { canvas, transform } = createPageCanvas(viewport, maxCanvasPixels);
      pendingCanvas = canvas;
      renderTask = page.render({ canvas, viewport, transform });
      await renderTask.promise;
      signal.throwIfAborted();

      // Swap the finished canvas in, freeing the one it replaces.
      const host = canvasHostRef.current;
      if (host) {
        releaseCanvasesIn(host);
        host.replaceChildren(canvas);
      }
      pendingCanvas = undefined;
    }

    async function renderTextLayer(
      pdfjs: Pdfjs,
      page: PDFPageProxy,
      viewport: PageViewport,
    ): Promise<void> {
      const container = document.createElement("div");
      container.className = "rpv-text-layer";
      const layer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent({
          includeMarkedContent: true,
          ...TEXT_CONTENT_OPTIONS,
        }),
        container,
        viewport,
      });
      pendingTextLayer = layer;
      await layer.render();
      signal.throwIfAborted();

      textHostRef.current?.replaceChildren(container);
      setTextLayer(layer);
    }

    const timer = setTimeout(() => {
      renderPage().catch((error: unknown) => {
        if (!signal.aborted && !isCancellation(error)) console.error(error);
      });
    }, renderDelay);

    return () => {
      controller.abort();
      clearTimeout(timer);
      renderTask?.cancel();
      pendingTextLayer?.cancel();
      if (pendingCanvas) releaseCanvas(pendingCanvas);
    };
  }, [doc, pageIndex, cssScale, renderDelay, maxCanvasPixels, canvasHostRef, textHostRef]);

  return textLayer;
}

/** Frees GPU memory and pdf.js page resources when the page scrolls out of range. */
function useReleaseResourcesOnUnmount(
  doc: PDFDocumentProxy,
  pageIndex: number,
  canvasHostRef: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    const host = canvasHostRef.current;
    return () => {
      if (host) releaseCanvasesIn(host);
      doc.getPage(pageIndex + 1).then(
        (page) => page.cleanup(),
        () => {}, // the document was already closed, which frees its pages anyway
      );
    };
  }, [doc, pageIndex, canvasHostRef]);
}
