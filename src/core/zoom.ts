import { PDF_TO_CSS_UNITS } from "./pdfjs.ts";
import type { PageSize, ZoomPreset } from "./types.ts";

/** The scales that zoom in / zoom out step through. */
const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
];

/** Ignore differences smaller than this, so 0.9999 doesn't count as "below 1". */
const EPSILON = 1e-3;

/** The next zoom step above `scale`, or `undefined` if there is none. */
export function nextZoomStep(scale: number): number | undefined {
  return ZOOM_STEPS.find((step) => step > scale + EPSILON);
}

/** The next zoom step below `scale`, or `undefined` if there is none. */
export function previousZoomStep(scale: number): number | undefined {
  return ZOOM_STEPS.findLast((step) => step < scale - EPSILON);
}

/**
 * The scale at which `page` fits the viewport: its full width for `page-width`, or the
 * whole page for `page-fit`. `padding` is the space to leave on each side, in px.
 */
export function fitScale(
  preset: ZoomPreset,
  page: PageSize,
  viewport: { width: number; height: number },
  padding: number,
): number {
  const widthScale = (viewport.width - padding * 2) / (page.width * PDF_TO_CSS_UNITS);
  const heightScale = (viewport.height - padding * 2) / (page.height * PDF_TO_CSS_UNITS);
  const scale = preset === "page-width" ? widthScale : Math.min(widthScale, heightScale);

  // Round down to 3 decimals so sub-pixel resize jitter doesn't trigger re-renders.
  return Math.floor(scale * 1000) / 1000;
}

/** Pixels of wheel movement that zoom by a factor of e. Smaller zooms faster. */
const WHEEL_ZOOM_SPEED = 100;
/**
 * The most one wheel event can count for, in px. A mouse wheel notch reports about
 * 100px (Windows) and would zoom by e^1 ≈ 2.7× at once; capped, it's about 1.28×.
 * Trackpad pinches and smooth scrolling report small deltas and stay proportional.
 */
const MAX_WHEEL_DELTA = 25;

/** How much one Ctrl/Cmd + wheel event (or trackpad pinch step) zooms by. */
export function wheelZoomFactor(deltaPixels: number): number {
  return Math.exp(-clamp(deltaPixels, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA) / WHEEL_ZOOM_SPEED);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
