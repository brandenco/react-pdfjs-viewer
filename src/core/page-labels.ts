import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * The label of each page ("i", "ii", "1", "A-1", …), or `null` if the document has none,
 * or its labels just repeat the page numbers.
 */
export async function loadPageLabels(doc: PDFDocumentProxy): Promise<readonly string[] | null> {
  const labels = await doc.getPageLabels();
  if (!labels) return null;
  return labels.some((label, index) => label !== String(index + 1)) ? labels : null;
}

/** The 1-based page with this label (exact, then case-insensitive), or `null`. */
export function pageNumberForLabel(labels: readonly string[], label: string): number | null {
  const wanted = label.trim();
  let index = labels.indexOf(wanted);
  if (index === -1) {
    const lower = wanted.toLowerCase();
    index = labels.findIndex((candidate) => candidate.toLowerCase() === lower);
  }
  return index === -1 ? null : index + 1;
}
