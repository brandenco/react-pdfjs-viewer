import type { PageViewport } from "pdfjs-dist";

/**
 * Creates a canvas sized for `viewport` at the screen's pixel density, scaled down if
 * needed so it never exceeds `maxPixels` (very large canvases can exhaust GPU memory).
 * Returns the canvas and the transform pdf.js should render with.
 */
export function createPageCanvas(
  viewport: PageViewport,
  maxPixels: number,
): { canvas: HTMLCanvasElement; transform: [number, number, number, number, number, number] } {
  const maxOutputScale = Math.sqrt(maxPixels / (viewport.width * viewport.height));
  const outputScale = Math.min(devicePixelRatio(), maxOutputScale);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
  canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));

  const scaleX = canvas.width / viewport.width;
  const scaleY = canvas.height / viewport.height;
  return { canvas, transform: [scaleX, 0, 0, scaleY, 0, 0] };
}

/** A rectangle on a page, in CSS px from its top-left corner. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function regionContains(outer: Region, inner: Region): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * The part of a page to draw on the detail canvas: the visible part plus a margin of
 * half its size on each side (so short scrolls need no redraw), kept on the page. The
 * margin shrinks if the canvas would go over `maxPixels` at `outputScale`.
 */
export function detailRegion(
  visible: Region,
  page: { width: number; height: number },
  maxPixels: number,
  outputScale: number,
): Region {
  const maxArea = maxPixels / (outputScale * outputScale);
  const visibleArea = visible.width * visible.height;
  // Margin as a fraction of the visible size per side: (1 + 2m)² × visible ≤ max.
  const margin = Math.max(0, Math.min(0.5, (Math.sqrt(maxArea / visibleArea) - 1) / 2));

  const left = Math.max(0, visible.x - visible.width * margin);
  const top = Math.max(0, visible.y - visible.height * margin);
  const right = Math.min(page.width, visible.x + visible.width * (1 + margin));
  const bottom = Math.min(page.height, visible.y + visible.height * (1 + margin));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function devicePixelRatio(): number {
  return globalThis.devicePixelRatio || 1;
}

/** Frees a canvas's backing memory right away instead of waiting for garbage collection. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export function releaseCanvasesIn(container: HTMLElement): void {
  for (const canvas of container.querySelectorAll("canvas")) releaseCanvas(canvas);
}

/** Whether `error` is pdf.js reporting a render or text layer we cancelled ourselves. */
export function isCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "RenderingCancelledException" || error.name === "AbortException";
}
