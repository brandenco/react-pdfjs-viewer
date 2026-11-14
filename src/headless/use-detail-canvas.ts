"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, type RefObject } from "react";

import type { Rotation } from "../core/types.ts";
import {
  detailRegion,
  devicePixelRatio,
  isCancellation,
  regionContains,
  releaseCanvas,
  releaseCanvasesIn,
  type Region,
} from "./canvas.ts";

export interface DetailCanvasOptions {
  document: PDFDocumentProxy;
  pageIndex: number;
  cssScale: number;
  rotation: Rotation;
  /** The page's size on screen, in CSS px. */
  width: number;
  height: number;
  maxCanvasPixels: number;
  renderDelay: number;
  zoomRenderDelay: number;
}

/**
 * Keeps zoomed-in pages sharp. A page canvas is capped at `maxCanvasPixels`, so at high
 * zoom the whole-page canvas has fewer pixels than the screen and looks blurry. Like
 * pdf.js' detail view, this draws just the visible part of the page (plus a margin) at
 * full resolution on a second canvas on top, and redraws it once scrolling leaves that
 * part. It does nothing while the whole-page canvas is sharp.
 *
 * The canvas is positioned in % of the page, so while zooming it stretches with the page
 * (like the whole-page canvas does) until the redraw at the new scale is ready.
 */
export function useDetailCanvas(
  pageRef: RefObject<HTMLElement | null>,
  hostRef: RefObject<HTMLElement | null>,
  options: DetailCanvasOptions,
): void {
  const { document: doc, pageIndex, cssScale, rotation, width, height, maxCanvasPixels } = options;
  const { renderDelay, zoomRenderDelay } = options;
  const lastScale = useRef<number | null>(null);

  // A detail canvas for another page orientation is in the wrong place: drop it.
  useEffect(() => {
    const host = hostRef.current;
    return () => {
      if (host) releaseCanvasesIn(host);
      host?.replaceChildren();
    };
    // Not read here: a new document, page or rotation is what makes the canvas stale.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [hostRef, doc, pageIndex, rotation]);

  useEffect(() => {
    const pageElement = pageRef.current;
    const host = hostRef.current;
    const container = pageElement?.closest<HTMLElement>(".rpv-pages");
    if (!pageElement || !host || !container) return;

    const outputScale = devicePixelRatio();
    const delay = renderDelayFor(lastScale, cssScale, renderDelay, zoomRenderDelay);
    if (width * height * outputScale * outputScale <= maxCanvasPixels) {
      // The whole-page canvas is sharp at this scale; a detail canvas would only cover it.
      // Wait the same delay as the whole-page canvas, so the old detail stays until then.
      const timer = setTimeout(() => {
        releaseCanvasesIn(host);
        host.replaceChildren();
      }, delay);
      return () => clearTimeout(timer);
    }

    const controller = new AbortController();
    const { signal } = controller;
    let rendered: Region | null = null;
    let renderTask: RenderTask | undefined;
    let pendingCanvas: HTMLCanvasElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let renderGeneration = 0;

    /** The part of the page in view, in CSS px from its top-left corner. */
    function visibleRegion(): Region | null {
      const view = container!.getBoundingClientRect();
      const page = pageElement!.getBoundingClientRect();
      const left = Math.max(view.left, page.left) - page.left;
      const top = Math.max(view.top, page.top) - page.top;
      const right = Math.min(view.right, page.right) - page.left;
      const bottom = Math.min(view.bottom, page.bottom) - page.top;
      if (right <= left || bottom <= top) return null;
      return { x: left, y: top, width: right - left, height: bottom - top };
    }

    function update(): void {
      const visible = visibleRegion();
      if (!visible || (rendered && regionContains(rendered, visible))) return;
      const region = detailRegion(visible, { width, height }, maxCanvasPixels, outputScale);
      render(region).catch((error: unknown) => {
        if (!signal.aborted && !isCancellation(error)) console.error(error);
      });
    }

    async function render(region: Region): Promise<void> {
      const generation = ++renderGeneration;
      renderTask?.cancel();
      renderTask = undefined;
      if (pendingCanvas) releaseCanvas(pendingCanvas);
      pendingCanvas = undefined;

      const page = await doc.getPage(pageIndex + 1);
      signal.throwIfAborted();
      // A newer render started while this one waited for the page; it has nothing to cancel.
      if (generation !== renderGeneration) return;
      const viewport = page.getViewport({ scale: cssScale, rotation: page.rotate + rotation });

      // The region at the screen's density, unless that's over the cap.
      const scale = Math.min(
        outputScale,
        Math.sqrt(maxCanvasPixels / (region.width * region.height)),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(region.width * scale));
      canvas.height = Math.max(1, Math.floor(region.height * scale));
      const scaleX = canvas.width / region.width;
      const scaleY = canvas.height / region.height;
      pendingCanvas = canvas;

      // Shifted so the region's top-left corner lands at the canvas's.
      const task = page.render({
        canvas,
        viewport,
        transform: [scaleX, 0, 0, scaleY, -region.x * scaleX, -region.y * scaleY],
      });
      renderTask = task;
      await task.promise;
      signal.throwIfAborted();

      Object.assign(canvas.style, {
        left: `${(region.x / width) * 100}%`,
        top: `${(region.y / height) * 100}%`,
        width: `${(region.width / width) * 100}%`,
        height: `${(region.height / height) * 100}%`,
      });
      releaseCanvasesIn(host!);
      host!.replaceChildren(canvas);
      pendingCanvas = undefined;
      rendered = region;
    }

    function schedule(waitMs: number): void {
      clearTimeout(timer);
      timer = setTimeout(update, waitMs);
    }

    // Scrolling: redraw once it settles, if it left the drawn region. A short wait, so
    // pages that only fly past are never drawn in detail.
    const onScroll = (): void => schedule(100);
    container.addEventListener("scroll", onScroll, { passive: true });
    // Observers report the current size right away; that's no change, so skip it.
    let isFirstResize = true;
    const resizeObserver = new ResizeObserver(() => {
      if (!isFirstResize) schedule(100);
      isFirstResize = false;
    });
    resizeObserver.observe(container);
    schedule(delay);

    return () => {
      controller.abort();
      clearTimeout(timer);
      container.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      renderTask?.cancel();
      if (pendingCanvas) releaseCanvas(pendingCanvas);
    };
  }, [
    pageRef,
    hostRef,
    doc,
    pageIndex,
    cssScale,
    rotation,
    width,
    height,
    maxCanvasPixels,
    renderDelay,
    zoomRenderDelay,
  ]);
}

/**
 * How long to wait before rendering at `cssScale`: `zoomRenderDelay` if the scale changed
 * since the last call (the user is zooming, and more steps are likely to follow),
 * otherwise `renderDelay`. Each effect keeps its own `lastScale` ref.
 */
export function renderDelayFor(
  lastScale: { current: number | null },
  cssScale: number,
  renderDelay: number,
  zoomRenderDelay: number,
): number {
  const isZooming = lastScale.current !== null && lastScale.current !== cssScale;
  lastScale.current = cssScale;
  return isZooming ? zoomRenderDelay : renderDelay;
}
