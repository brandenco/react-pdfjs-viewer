import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { readPageGeometry, type PageGeometry } from "./page-geometry.ts";
import { runtime } from "./runtime.ts";
import { yieldToMain } from "./schedule.ts";
import type { DocumentInitParameters, PdfSource } from "./types.ts";

/** Turns a `PdfSource` into the `url` / `data` part of pdf.js `getDocument()` options. */
export function toInitSource(source: PdfSource): DocumentInitParameters {
  if (typeof source === "string" || source instanceof URL) {
    return { url: source };
  }
  // pdf.js transfers (detaches) the buffer to its worker; copy so callers keep theirs.
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  return { data: bytes.slice() };
}

/** The `.pdf` filename at the end of a URL source, if there is one. */
export function filenameFromSource(source: PdfSource): string | undefined {
  if (typeof source !== "string" && !(source instanceof URL)) {
    return undefined;
  }
  try {
    const url = new URL(source, runtime.location?.href);
    const name = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    return name.toLowerCase().endsWith(".pdf") ? name : undefined;
  } catch {
    return undefined;
  }
}

const PAGES_PER_BATCH = 64;

/**
 * Reads the geometry (size, view box, rotation) of every page after the first, in
 * batches, at background priority so it never competes with rendering. Yields
 * `[pageIndex, geometry]` pairs batch by batch.
 */
export async function* readPageGeometries(
  doc: PDFDocumentProxy,
): AsyncGenerator<[pageIndex: number, geometry: PageGeometry][]> {
  for (let first = 2; first <= doc.numPages; first += PAGES_PER_BATCH) {
    const last = Math.min(doc.numPages, first + PAGES_PER_BATCH - 1);

    const pages: Promise<PDFPageProxy>[] = [];
    for (let pageNumber = first; pageNumber <= last; pageNumber++) {
      pages.push(doc.getPage(pageNumber));
    }
    // Batches run one after another on purpose, to leave the worker free for visible pages.
    // oxlint-disable-next-line no-await-in-loop
    const loaded = await Promise.all(pages);
    yield loaded.map((page) => [page.pageNumber - 1, readPageGeometry(page)]);

    // oxlint-disable-next-line no-await-in-loop
    await yieldToMain("background");
  }
}
