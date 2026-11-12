/**
 * Per-document memo for data that is read once and never changes: outline, metadata,
 * page labels, attachments. Keyed weakly by the document, so closing a document frees
 * its entries. Lives outside the store so each feature stays tree-shakeable.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

const cache = new WeakMap<PDFDocumentProxy, Map<unknown, Promise<unknown>>>();

/** `load(doc)`, run once per document and `load` function. Failures aren't cached. */
export function readDocumentData<T>(
  doc: PDFDocumentProxy,
  load: (doc: PDFDocumentProxy) => Promise<T>,
): Promise<T> {
  let entries = cache.get(doc);
  if (!entries) {
    entries = new Map();
    cache.set(doc, entries);
  }

  const cached = entries.get(load);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- keyed by `load`, so it's a T
  if (cached) return cached as Promise<T>;

  const promise = load(doc);
  entries.set(load, promise);
  promise.catch(() => entries.delete(load)); // allow a retry
  return promise;
}
