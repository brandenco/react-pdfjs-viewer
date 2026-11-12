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
