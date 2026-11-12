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
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";

import type { PdfjsLinkService } from "../core/link-service.ts";
import {
  createPageTransform,
  normalizeRotation,
  type PageGeometry,
  type PageTransform,
} from "../core/page-geometry.ts";
import { loadPdfjs, type Pdfjs } from "../core/pdfjs.ts";
import { TEXT_CONTENT_OPTIONS } from "../core/text.ts";
import type { Rotation } from "../core/types.ts";
import { createPageCanvas, isCancellation, releaseCanvas, releaseCanvasesIn } from "./canvas.ts";
import { nameLinks } from "./link-names.ts";
import { renderDelayFor, useDetailCanvas } from "./use-detail-canvas.ts";
import { useSearchHighlights } from "./use-search-highlights.ts";

export interface PdfPageProps {
  document: PDFDocumentProxy;
  pageIndex: number;
  /** Total number of pages, for screen readers (`aria-setsize`). */
  pageCount: number;
  /** The pdf.js viewport scale: the user's zoom × PDF-to-CSS units. */
  cssScale: number;
  /** The viewer's rotation, added to the page's own. */
  rotation: Rotation;
  /** Position and size in the scroll container, in px. */
  top: number;
  width: number;
  height: number;
  renderDelay: number;
  /** The render delay after a scale change, while more zoom steps are likely. */
  zoomRenderDelay: number;
  maxCanvasPixels: number;
  /** Handles clicks on links. `null` skips the annotation layer. */
  linkService: PdfjsLinkService | null;
  /** The page's view box and own rotation, for the overlay's coordinate helpers. */
  geometry: PageGeometry;
  renderOverlay: ((page: PageOverlayInfo) => ReactNode) | undefined;
}

/** What `renderPageOverlay` gets for each mounted page. */
export interface PageOverlayInfo extends PageTransform {
  /** 0-based. */
  pageIndex: number;
  /** 1-based. */
  pageNumber: number;
  /** The page's (and the overlay's) size on screen, in CSS px. */
  width: number;
  height: number;
  /** CSS px per PDF unit: the zoom × 96/72. */
  scale: number;
  /** Clockwise rotation on screen: the page's own plus the viewer's. */
  rotation: Rotation;
}

/** One page: a canvas, a selectable text layer, search highlights, and clickable links. */
export const PdfPage: (props: PdfPageProps) => ReactNode = memo(function PdfPage(props) {
  const { document: doc, pageIndex, pageCount, cssScale, rotation, top, width, height } = props;
  const { geometry, renderOverlay } = props;
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const textHostRef = useRef<HTMLDivElement>(null);
  const annotationHostRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLLIElement>(null);
  const detailHostRef = useRef<HTMLDivElement>(null);

  const rendered = useRenderedPage(props, canvasHostRef, textHostRef, annotationHostRef);
  useDetailCanvas(pageRef, detailHostRef, props);
  useSearchHighlights(pageIndex, rendered?.textLayer ?? null);
  useReleaseResourcesOnUnmount(doc, pageIndex, canvasHostRef);

  const overlayInfo = useMemo<PageOverlayInfo | null>(
    () =>
      renderOverlay
        ? {
            pageIndex,
            pageNumber: pageIndex + 1,
            width,
            height,
            scale: cssScale,
            rotation: normalizeRotation(geometry.rotate + rotation),
            ...createPageTransform(geometry, cssScale, rotation),
          }
        : null,
    [renderOverlay, pageIndex, width, height, cssScale, rotation, geometry],
  );

  // pdf.js sizes the text layer from `--total-scale-factor`.
  const style = { top, width, height, "--total-scale-factor": cssScale } as CSSProperties;
  // Until the page is re-rendered at a new rotation, the old rendering is turned to match.
  const staleStyle = rendered
    ? rotatedLayerStyle(normalizeRotation(rotation - rendered.rotation), width, height)
    : undefined;

  return (
    <li
      ref={pageRef}
      className="rpv-page"
      style={style}
      data-page-number={pageIndex + 1}
      aria-label={`Page ${pageIndex + 1}`}
      aria-posinset={pageIndex + 1}
      aria-setsize={pageCount}
    >
      {/* The canvas is a picture of the text layer above it; keep it out of the a11y tree. */}
      <div ref={canvasHostRef} className="rpv-page-canvas" style={staleStyle} aria-hidden="true" />
      {/* The visible part again, sharper, when the page canvas is capped (high zoom). */}
      <div ref={detailHostRef} className="rpv-page-detail" aria-hidden="true" />
      <div ref={textHostRef} className="rpv-page-text" style={staleStyle} />
      <div ref={annotationHostRef} className="rpv-page-annotations" style={staleStyle} />
      {overlayInfo && renderOverlay && (
        <div className="rpv-page-overlay">{renderOverlay(overlayInfo)}</div>
      )}
    </li>
  );
});

/**
 * Turns layers rendered at an older rotation to match the page's current one, so the
 * page shows rotated right away instead of squeezed upright into the rotated box (what
 * pdf.js' viewer does too). `undefined` when they're up to date.
 *
 * The box is the page's box in the old orientation (at the current scale, which the text
 * and link layers follow through `--total-scale-factor`), rotated around its center.
 */
function rotatedLayerStyle(
  rotationDelta: Rotation,
  width: number,
  height: number,
): CSSProperties | undefined {
  if (rotationDelta === 0) return undefined;
  const isSideways = rotationDelta % 180 !== 0;
  return {
    position: "absolute",
    left: isSideways ? (width - height) / 2 : 0,
    top: isSideways ? (height - width) / 2 : 0,
    width: isSideways ? height : width,
    height: isSideways ? width : height,
    transform: `rotate(${rotationDelta}deg)`,
    // Briefly: selecting or clicking stale text and links isn't worth the confusion.
    pointerEvents: "none",
  };
}

interface RenderedPage {
  textLayer: TextLayer;
  /** The viewer rotation the layers on screen were rendered at. */
  rotation: Rotation;
}

/**
 * Renders the page's canvas and text layer, and re-renders them when the scale changes.
 *
 * Rendering waits `renderDelay` ms, so pages that only fly past during fast scrolling
 * never reach the pdf.js worker, and `zoomRenderDelay` ms after a scale change, so the
 * in-between steps of a zoom (wheel, pinch) don't either. The old canvas
 * stays on screen (stretched, or turned after a rotation) until the new one is ready, so
 * zooming and rotating never flash blank. The canvas, text and link layers are swapped
 * in together, so they never show different orientations.
 *
 * Returns the current text layer and its rotation once it has rendered.
 */
function useRenderedPage(
  props: PdfPageProps,
  canvasHostRef: RefObject<HTMLDivElement | null>,
  textHostRef: RefObject<HTMLDivElement | null>,
  annotationHostRef: RefObject<HTMLDivElement | null>,
): RenderedPage | null {
  const {
    document: doc,
    pageIndex,
    cssScale,
    rotation,
    renderDelay,
    zoomRenderDelay,
    maxCanvasPixels,
    linkService,
  } = props;
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const lastScale = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let renderTask: RenderTask | undefined;
    let pendingTextLayer: TextLayer | undefined;
    let pendingCanvas: HTMLCanvasElement | undefined;

    async function renderPage(): Promise<void> {
      const [pdfjs, page] = await Promise.all([loadPdfjs(), doc.getPage(pageIndex + 1)]);
      signal.throwIfAborted();

      const viewport = page.getViewport({ scale: cssScale, rotation: page.rotate + rotation });
      const [canvas, text, annotationLayerElement] = await Promise.all([
        renderCanvas(page, viewport),
        renderTextLayer(pdfjs, page, viewport),
        renderAnnotationLayer(pdfjs, page, viewport),
      ]);
      signal.throwIfAborted();

      // Swap everything in at once, freeing the canvas it replaces.
      const canvasHost = canvasHostRef.current;
      if (canvasHost) {
        releaseCanvasesIn(canvasHost);
        canvasHost.replaceChildren(canvas);
      }
      pendingCanvas = undefined;
      textHostRef.current?.replaceChildren(text.element);
      if (annotationLayerElement)
        annotationHostRef.current?.replaceChildren(annotationLayerElement);
      else annotationHostRef.current?.replaceChildren();
      // Synchronously, so the stale-rotation transform comes off in the same frame.
      flushSync(() => setRendered({ textLayer: text.layer, rotation }));
      // Measures the text each link covers, so both layers must be in place.
      if (annotationLayerElement) nameLinks(annotationLayerElement, text.element);
    }

    async function renderAnnotationLayer(
      pdfjs: Pdfjs,
      page: PDFPageProxy,
      viewport: PageViewport,
    ): Promise<HTMLElement | null> {
      if (!linkService) return null;
      // Links only, for now: other annotation types (popups, form fields) need UI and
      // styles this viewer doesn't have yet. Their appearance is drawn on the canvas.
      const annotations = (await page.getAnnotations({ intent: "display" })).filter(
        (annotation: { annotationType?: number }) =>
          annotation.annotationType === pdfjs.AnnotationType.LINK,
      );
      signal.throwIfAborted();

      // Most pages have no annotations; skip the layer's DOM entirely for them.
      if (annotations.length === 0) return null;

      const container = document.createElement("div");
      container.className = "rpv-annotation-layer";
      // The layer positions its elements unflipped; pdf.js' own viewer does the same.
      const layerViewport = viewport.clone({ dontFlip: true });
      const layer = new pdfjs.AnnotationLayer({
        div: container,
        page,
        viewport: layerViewport,
        linkService,
        accessibilityManager: null,
        annotationCanvasMap: null,
        annotationEditorUIManager: null,
        structTreeLayer: null,
        commentManager: null,
        annotationStorage: null,
      });
      await layer.render({
        annotations,
        div: container,
        page,
        viewport: layerViewport,
        linkService,
        // Form fields are drawn on the canvas; interactive forms aren't supported yet.
        renderForms: false,
      });
      signal.throwIfAborted();
      return container;
    }

    async function renderCanvas(
      page: PDFPageProxy,
      viewport: PageViewport,
    ): Promise<HTMLCanvasElement> {
      const { canvas, transform } = createPageCanvas(viewport, maxCanvasPixels);
      pendingCanvas = canvas;
      renderTask = page.render({ canvas, viewport, transform });
      await renderTask.promise;
      signal.throwIfAborted();
      return canvas;
    }

    async function renderTextLayer(
      pdfjs: Pdfjs,
      page: PDFPageProxy,
      viewport: PageViewport,
    ): Promise<{ element: HTMLElement; layer: TextLayer }> {
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
      return { element: container, layer };
    }

    const delay = renderDelayFor(lastScale, cssScale, renderDelay, zoomRenderDelay);
    const timer = setTimeout(() => {
      renderPage().catch((error: unknown) => {
        if (!signal.aborted && !isCancellation(error)) console.error(error);
      });
    }, delay);

    return () => {
      controller.abort();
      clearTimeout(timer);
      renderTask?.cancel();
      pendingTextLayer?.cancel();
      if (pendingCanvas) releaseCanvas(pendingCanvas);
    };
  }, [
    doc,
    pageIndex,
    cssScale,
    rotation,
    renderDelay,
    zoomRenderDelay,
    maxCanvasPixels,
    linkService,
    canvasHostRef,
    textHostRef,
    annotationHostRef,
  ]);

  return rendered;
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
