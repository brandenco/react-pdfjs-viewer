import type { PDFDocumentProxy } from "pdfjs-dist";

import { readDocumentData } from "./document-data.ts";
import { destinationPageIndex, type PdfDestination } from "./navigation.ts";

type PdfjsOutlineItem = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];

/** One entry of the document outline (bookmarks), as pdf.js reports it. */
export interface OutlineItem extends Omit<PdfjsOutlineItem, "dest" | "items"> {
  /** Where the entry points in this document, if it's an internal entry. */
  readonly dest: PdfDestination | null;
  readonly items: readonly OutlineItem[];
}

/** The document's outline; empty when it has none. */
export async function loadOutline(doc: PDFDocumentProxy): Promise<readonly OutlineItem[]> {
  // pdf.js resolves to `null` for documents without an outline, despite its types.
  const outline = (await doc.getOutline()) as PdfjsOutlineItem[] | null;
  // `items` is typed any[] by pdf.js; the nested entries have the same shape.
  return outline ?? [];
}

/** An outline entry with the 0-based page it points to, in reading order. */
export interface OutlineEntryPage {
  readonly item: OutlineItem;
  readonly pageIndex: number;
  /** The entries it's nested in, outermost first. */
  readonly ancestors: readonly OutlineItem[];
}

/**
 * Every internal outline entry with the page it points to, in reading (pre-)order.
 * Used to find the entry for the page being read.
 */
export async function loadOutlinePages(
  doc: PDFDocumentProxy,
): Promise<readonly OutlineEntryPage[]> {
  const outline = await readDocumentData(doc, loadOutline);
  const flat: { item: OutlineItem; ancestors: readonly OutlineItem[] }[] = [];
  const walk = (items: readonly OutlineItem[], ancestors: readonly OutlineItem[]): void => {
    for (const item of items) {
      flat.push({ item, ancestors });
      walk(item.items, [...ancestors, item]);
    }
  };
  walk(outline, []);

  const pages = await Promise.all(
    flat.map(({ item }) =>
      item.dest === null
        ? Promise.resolve(null)
        : destinationPageIndex(doc, item.dest).catch(() => null),
    ),
  );

  return flat.flatMap((entry, index) => {
    const pageIndex = pages[index];
    return pageIndex === null || pageIndex === undefined ? [] : [{ ...entry, pageIndex }];
  });
}

/**
 * The entry for the page being read: the last one, in reading order, that starts on or
 * before it. Its ancestors come along, to mark collapsed parents that contain it.
 */
export function outlineEntryAt(
  entries: readonly OutlineEntryPage[],
  pageIndex: number,
): OutlineEntryPage | null {
  let current: OutlineEntryPage | null = null;
  for (const entry of entries) {
    if (entry.pageIndex <= pageIndex) current = entry;
    // Outlines are almost always in page order, but nothing requires it, so don't stop early.
  }
  return current;
}
