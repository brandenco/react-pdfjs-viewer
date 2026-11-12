import type { PDFPageProxy } from "pdfjs-dist";

import type { PageSize, Rotation } from "./types.ts";

/** What places a page's content on screen: its visible area and its own rotation. */
export interface PageGeometry {
  /** The page's visible area (its CropBox) in PDF user space: `[x1, y1, x2, y2]`. */
  readonly view: readonly [number, number, number, number];
  /** The page's own clockwise rotation (its /Rotate entry). */
  readonly rotate: Rotation;
}

/** A rectangle in px from a page's top-left corner, as shown on screen. */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts between PDF user space (points, y up, origin wherever the page's view box
 * puts it) and a page's on-screen box (px, y down, origin at the top-left corner).
 * The same math as pdf.js' `PageViewport`, without loading the page first.
 */
export interface PageTransform {
  /** On-screen px → PDF user space. */
  toPdfPoint: (x: number, y: number) => [x: number, y: number];
  /** PDF user space → on-screen px. */
  toViewportPoint: (x: number, y: number) => [x: number, y: number];
  /** A PDF rect `[x1, y1, x2, y2]` (corners in any order) → on-screen px. */
  toViewportRect: (rect: readonly number[]) => ViewportRect;
  /** An on-screen rect → PDF user space `[x1, y1, x2, y2]`, normalized so x1 ≤ x2, y1 ≤ y2. */
  toPdfRect: (rect: ViewportRect) => [x1: number, y1: number, x2: number, y2: number];
}

export function readPageGeometry(page: PDFPageProxy): PageGeometry {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;
  return { view: [x1, y1, x2, y2], rotate: normalizeRotation(page.rotate) };
}

/** The page's size at scale 1 with its own rotation applied (not the viewer's). */
export function pageSizeOf({ view, rotate }: PageGeometry): PageSize {
  const width = Math.abs(view[2] - view[0]);
  const height = Math.abs(view[3] - view[1]);
  return rotate % 180 === 0 ? { width, height } : { width: height, height: width };
}

export function isSameGeometry(a: PageGeometry | undefined, b: PageGeometry): boolean {
  return (
    a !== undefined && a.rotate === b.rotate && a.view.every((value, i) => value === b.view[i])
  );
}

/**
 * The transform for a page shown at `scale` (CSS px per PDF unit) with the viewer's
 * `rotation` added to the page's own.
 */
export function createPageTransform(
  geometry: PageGeometry,
  scale: number,
  rotation: Rotation,
): PageTransform {
  const [m0, m1, m2, m3, m4, m5] = viewportMatrix(
    geometry.view,
    scale,
    normalizeRotation(geometry.rotate + rotation),
  );
  const determinant = m0 * m3 - m1 * m2;

  function toViewportPoint(x: number, y: number): [number, number] {
    return [x * m0 + y * m2 + m4, x * m1 + y * m3 + m5];
  }

  function toPdfPoint(x: number, y: number): [number, number] {
    return [
      (x * m3 - y * m2 + m2 * m5 - m4 * m3) / determinant,
      (-x * m1 + y * m0 + m4 * m1 - m5 * m0) / determinant,
    ];
  }

  return {
    toViewportPoint,
    toPdfPoint,
    toViewportRect(rect) {
      const [ax, ay] = toViewportPoint(rect[0] ?? 0, rect[1] ?? 0);
      const [bx, by] = toViewportPoint(rect[2] ?? 0, rect[3] ?? 0);
      return {
        left: Math.min(ax, bx),
        top: Math.min(ay, by),
        width: Math.abs(bx - ax),
        height: Math.abs(by - ay),
      };
    },
    toPdfRect({ left, top, width, height }) {
      const [ax, ay] = toPdfPoint(left, top);
      const [bx, by] = toPdfPoint(left + width, top + height);
      return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
    },
  };
}

/** pdf.js' `PageViewport` transform (with no offset, and flipped: y down). */
function viewportMatrix(
  view: PageGeometry["view"],
  scale: number,
  rotation: Rotation,
): [number, number, number, number, number, number] {
  const [x1, y1, x2, y2] = view;
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  // Rotation, then flipping the y axis.
  const [a, b, c, d] =
    rotation === 90
      ? [0, 1, 1, 0]
      : rotation === 180
        ? [-1, 0, 0, 1]
        : rotation === 270
          ? [0, -1, -1, 0]
          : [1, 0, 0, -1];

  // Moves the rotated view box's center to the center of the on-screen box.
  const isSideways = a === 0;
  const offsetX = Math.abs((isSideways ? centerY - y1 : centerX - x1) * scale);
  const offsetY = Math.abs((isSideways ? centerX - x1 : centerY - y1) * scale);

  return [
    a * scale,
    b * scale,
    c * scale,
    d * scale,
    offsetX - a * scale * centerX - c * scale * centerY,
    offsetY - b * scale * centerX - d * scale * centerY,
  ];
}

export function normalizeRotation(degrees: number): Rotation {
  const quarterTurns = ((Math.round(degrees / 90) % 4) + 4) % 4;
  return ([0, 90, 180, 270] as const)[quarterTurns]!;
}
