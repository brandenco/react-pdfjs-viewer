/**
 * pdf.js is loaded lazily so importing this library never touches DOM-only globals
 * during SSR. Everything that needs the runtime goes through `loadPdfjs()`.
 */
import type * as PdfjsModule from "pdfjs-dist";

export type Pdfjs = typeof PdfjsModule;

let pdfjsPromise: Promise<Pdfjs> | null = null;

export function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= import("pdfjs-dist");
  return pdfjsPromise;
}

/** pdf.js renders 1 PDF point as 1 CSS px at scale 1; real-world size needs 96/72. */
export const PDF_TO_CSS_UNITS: number = 96 / 72;
