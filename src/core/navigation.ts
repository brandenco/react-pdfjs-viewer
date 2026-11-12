/**
 * PDF destinations: where links, outline entries and named destinations point to.
 *
 * pdf.js describes a destination either by name (a string to look up in the document)
 * or explicitly, as `[pageRef, { name: "XYZ" | "Fit" | … }, ...args]`. This module turns
 * either into a page and a position on it, as fractions of the page's size, which the
 * scroll container can apply at any zoom level or rotation.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

/** A named destination, or an explicit destination array as pdf.js returns it. */
export type PdfDestination = string | readonly unknown[];

/** A point on a page, as fractions (0–1) of its rendered width and height. */
export interface PagePosition {
  /** From the page's left edge. `undefined` keeps the horizontal scroll position. */
  readonly left?: number | undefined;
  /** From the page's top edge. `undefined` scrolls to the top of the page. */
  readonly top?: number | undefined;
}

/** Where a destination points: a 0-based page, and optionally a point on it. */
export interface PageTarget extends PagePosition {
  readonly pageIndex: number;
}

interface RefProxy {
  num: number;
  gen: number;
}

function isRef(value: unknown): value is RefProxy {
  return (
    typeof value === "object" &&
    value !== null &&
    "num" in value &&
    "gen" in value &&
    typeof value.num === "number" &&
    typeof value.gen === "number"
  );
}

function asCoordinate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * The point in PDF user space (origin bottom-left) an explicit destination's view type
 * asks for. Either coordinate may be missing ("keep the current position").
 */
export function destinationPoint(explicit: readonly unknown[]): {
  x: number | undefined;
  y: number | undefined;
} {
  const view = explicit[1];
  const name =
    typeof view === "object" && view !== null && "name" in view && typeof view.name === "string"
      ? view.name
      : "";
  const args = explicit.slice(2);

  switch (name) {
    case "XYZ":
      return { x: asCoordinate(args[0]), y: asCoordinate(args[1]) };
    case "FitH":
    case "FitBH":
      return { x: undefined, y: asCoordinate(args[0]) };
    case "FitV":
    case "FitBV":
      return { x: asCoordinate(args[0]), y: undefined };
    case "FitR":
      // [left, bottom, right, top]: show the top-left corner of the rectangle.
      return { x: asCoordinate(args[0]), y: asCoordinate(args[3]) };
    default:
      // "Fit", "FitB", or unknown: the whole page.
      return { x: undefined, y: undefined };
  }
}

/**
 * Resolves a destination to a page and a position on it, or `null` if it doesn't point
 * anywhere in this document. `rotation` is the viewer's extra rotation, in degrees.
 */
export async function resolveDestination(
  doc: PDFDocumentProxy,
  destination: PdfDestination,
  rotation = 0,
): Promise<PageTarget | null> {
  const explicit =
    typeof destination === "string" ? await doc.getDestination(destination) : destination;
  if (!explicit || explicit.length === 0) return null;

  const pageIndex = await pageIndexOf(doc, explicit[0]);
  if (pageIndex === null || pageIndex < 0 || pageIndex >= doc.numPages) return null;

  const { x, y } = destinationPoint(explicit);
  if (x === undefined && y === undefined) return { pageIndex };

  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1, rotation: page.rotate + rotation });
  // Missing coordinates fall back to the page's own origin corner; only the provided
  // ones are reported, so a missing one keeps the current scroll position on that axis.
  const [viewX, viewY] = viewport.convertToViewportPoint(x ?? page.view[0]!, y ?? page.view[3]!);
  const left = clampFraction(viewX / viewport.width);
  const top = clampFraction(viewY / viewport.height);

  // With rotation, a PDF x coordinate can become a vertical position and vice versa.
  const quarterTurned = (((page.rotate + rotation) % 180) + 180) % 180 === 90;
  const hasLeft = quarterTurned ? y !== undefined : x !== undefined;
  const hasTop = quarterTurned ? x !== undefined : y !== undefined;
  return {
    pageIndex,
    ...(hasLeft ? { left } : {}),
    ...(hasTop ? { top } : {}),
  };
}

/** The 0-based page a destination points to, without resolving the position on it. */
export async function destinationPageIndex(
  doc: PDFDocumentProxy,
  destination: PdfDestination,
): Promise<number | null> {
  const explicit =
    typeof destination === "string" ? await doc.getDestination(destination) : destination;
  if (!explicit || explicit.length === 0) return null;
  const pageIndex = await pageIndexOf(doc, explicit[0]);
  return pageIndex !== null && pageIndex >= 0 && pageIndex < doc.numPages ? pageIndex : null;
}

async function pageIndexOf(doc: PDFDocumentProxy, page: unknown): Promise<number | null> {
  // Destinations from other documents (remote GoTo) use a 0-based page number.
  if (typeof page === "number" && Number.isInteger(page)) return page;
  if (!isRef(page)) return null;
  try {
    return await doc.getPageIndex(page);
  } catch {
    return null; // a dangling reference
  }
}

function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
