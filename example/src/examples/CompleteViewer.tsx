// The complete viewer: toolbar, sidebar (thumbnails and outline), pages and search, in
// one component. It fills its container, so the container needs a height.
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useState, type ReactNode } from "react";
import type { PdfSource } from "react-pdfjs-viewer/headless";
import { PdfViewer } from "react-pdfjs-viewer/ui";

import { workerSrc } from "../pdf-worker.ts";

export function CompleteViewer({ src }: { src: PdfSource }): ReactNode {
  const [status, setStatus] = useState("Loading…");

  function onDocumentLoad(document: PDFDocumentProxy): void {
    setStatus(`Loaded ${document.numPages} pages`);
  }

  return (
    <div className="example-column">
      <output className="example-status">{status}</output>
      <PdfViewer
        className="example-fill"
        src={src} // a URL, a `URL`, or the bytes (Uint8Array / ArrayBuffer)
        workerSrc={workerSrc}
        initialScale="page-width" // a number (1 = 100%), "page-fit" (default) or "page-width"
        initialPage={1}
        initialSidebarOpen
        filename="sample.pdf" // for downloads
        // Passed to pdf.js getDocument(): password, cMapUrl, httpHeaders, …
        documentOptions={{}}
        onDocumentLoad={onDocumentLoad}
        onError={(error) => setStatus(`Couldn't open the document: ${error.message}`)}
      />
    </div>
  );
}
