/**
 * Printing: renders every page to an image at print resolution, puts the images in a
 * hidden iframe with print styles, and prints that iframe. This is what pdf.js' own
 * viewer does; printing the on-screen pages instead would print only the few that
 * virtualization has mounted, at screen resolution.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

import { loadPdfjs } from "./pdfjs.ts";
import { yieldToMain } from "./schedule.ts";

export interface PrintOptions {
  /** Resolution of the rendered pages, in dots per inch. Default 150. */
  dpi?: number | undefined;
  /** The viewer's rotation, added to each page's own. Default 0. */
  rotation?: number | undefined;
  /** Called after each page is rendered. */
  onProgress?: ((pagesRendered: number, pageCount: number) => void) | undefined;
  /** Cancels rendering. Has no effect once the browser's print dialog is open. */
  signal?: AbortSignal | undefined;
}

/** PDF points per inch. */
const POINTS_PER_INCH = 72;

/** Renders and prints `doc`. Resolves once the print dialog closes. */
export async function printDocument(
  doc: PDFDocumentProxy,
  options: PrintOptions = {},
): Promise<void> {
  const { dpi = 150, rotation = 0, onProgress, signal } = options;
  const pdfjs = await loadPdfjs();
  signal?.throwIfAborted();

  const urls: string[] = [];
  const frame = document.createElement("iframe");
  frame.title = "Print preview";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Off-screen rather than display:none, which some browsers refuse to print.
  frame.style.cssText =
    "position:fixed;inset-inline-start:-10000px;inline-size:1px;block-size:1px;border:0";
  document.body.append(frame);

  try {
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error("Couldn't create the print frame");

    let pageSize: { width: number; height: number } | null = null;
    const images: HTMLImageElement[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      // Pages render one at a time, to bound memory on large documents.
      // oxlint-disable-next-line no-await-in-loop
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({
        scale: dpi / POINTS_PER_INCH,
        rotation: page.rotate + rotation,
      });
      const cssViewport = page.getViewport({ scale: 1, rotation: page.rotate + rotation });
      pageSize ??= { width: cssViewport.width, height: cssViewport.height };

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // oxlint-disable-next-line no-await-in-loop
      await page.render({
        canvas,
        viewport,
        intent: "print",
        annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE,
      }).promise;
      // oxlint-disable-next-line no-await-in-loop
      const blob = await canvasToBlob(canvas);
      canvas.width = 0; // free the canvas memory now, not at garbage collection
      canvas.height = 0;
      page.cleanup();
      signal?.throwIfAborted();

      const url = URL.createObjectURL(blob);
      urls.push(url);
      const image = frameDocument.createElement("img");
      image.src = url;
      image.alt = "";
      images.push(image);
      onProgress?.(pageNumber, doc.numPages);
      // oxlint-disable-next-line no-await-in-loop
      await yieldToMain();
    }

    const style = frameDocument.createElement("style");
    // Like pdf.js, every sheet takes the first page's size; others are scaled to fit.
    const size = pageSize ? `${pageSize.width}pt ${pageSize.height}pt` : "auto";
    style.textContent = `
      @page { size: ${size}; margin: 0; }
      html, body { margin: 0; padding: 0; }
      img { display: block; inline-size: 100%; block-size: 100vh; object-fit: contain;
            break-after: page; break-inside: avoid; }
      img:last-child { break-after: auto; }
    `;
    frameDocument.head.append(style);
    frameDocument.body.append(...images);
    await Promise.all(images.map((image) => image.decode()));
    signal?.throwIfAborted();

    const frameWindow = frame.contentWindow;
    if (!frameWindow) throw new Error("Couldn't create the print frame");
    const listeners = new AbortController();
    const { promise: closed, resolve: done } = Promise.withResolvers<void>();
    frameWindow.addEventListener("afterprint", () => done(), { signal: listeners.signal });
    // A fallback for browsers that don't fire `afterprint` for iframes: the dialog
    // closing hands focus back to the page.
    window.addEventListener("focus", () => done(), { signal: listeners.signal });
    frameWindow.focus();
    frameWindow.print();
    // Focus may return to the frame rather than the page. Listened for only now, so the
    // `focus()` call above can't count as the dialog closing.
    frameWindow.addEventListener("focus", () => done(), { signal: listeners.signal });
    // `print()` blocks until the dialog closes in most browsers. Where it doesn't, the
    // frame must stay until the dialog closes, or there'd be nothing left to print.
    await closed;
    listeners.abort();
  } finally {
    frame.remove();
    for (const url of urls) URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't encode a page for printing"));
    }, "image/png");
  });
}
