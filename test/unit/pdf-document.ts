// Opens fixture PDFs with pdf.js in Node, for unit tests of the document-reading code.
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
// The legacy build is pdf.js' build for Node.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, beforeAll } from "vitest";

/** Opens `bytes` before the suite's tests and closes it after. Read `.current` in tests. */
export function useTestDocument(bytes: () => Uint8Array): { readonly current: PDFDocumentProxy } {
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let doc: PDFDocumentProxy | undefined;
  beforeAll(async () => {
    loadingTask = getDocument({ data: bytes() });
    doc = await loadingTask.promise;
  });
  afterAll(() => loadingTask?.destroy());
  return {
    get current(): PDFDocumentProxy {
      if (!doc) throw new Error("The test document is only open while tests run");
      return doc;
    },
  };
}
