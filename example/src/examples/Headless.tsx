import {
  PdfPages,
  PdfThumbnails,
  PdfViewerProvider,
  useCursorMode,
  usePageNavigation,
  usePdfDocument,
  useRotation,
  useZoom,
  type PdfSource,
} from "@brandenco/react-pdfjs-viewer/headless";
// Any interface, built on the hooks and the rendering primitives (`PdfPages`,
// `PdfThumbnails`). Nothing from `@brandenco/react-pdfjs-viewer/ui` is imported, so none of it ends
// up in your bundle. A headless app imports `@brandenco/react-pdfjs-viewer/core.css` (page layout,
// text selection, search highlights) and styles everything else itself; this example
// app imports ui.css once for all its pages, which includes core.css.
//
// Each hook subscribes only to the state it returns, and actions (`nextPage`, `zoomIn`,
// …) keep their identity across renders, so they're safe to pass straight to `onClick`.
import type { ReactNode } from "react";

import { workerSrc } from "../pdf-worker.ts";

export function Headless({ src }: { src: PdfSource }): ReactNode {
  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialScale="page-width">
      <div className="headless">
        <Toolbar />
        <div className="headless-body">
          <PdfThumbnails className="headless-thumbnails" width={96} />
          <PdfPages className="headless-pages" />
        </div>
      </div>
    </PdfViewerProvider>
  );
}

function Toolbar(): ReactNode {
  const { status } = usePdfDocument();
  const navigation = usePageNavigation();
  const zoom = useZoom();
  const rotation = useRotation();
  const cursor = useCursorMode();
  const isReady = status === "ready";

  return (
    <div className="headless-toolbar">
      <button type="button" disabled={!navigation.canGoPrevious} onClick={navigation.previousPage}>
        Previous
      </button>
      <span>
        Page {navigation.currentPage} of {navigation.numPages}
      </span>
      <button type="button" disabled={!navigation.canGoNext} onClick={navigation.nextPage}>
        Next
      </button>

      <span className="headless-separator" />
      <button type="button" disabled={!zoom.canZoomOut} onClick={zoom.zoomOut}>
        −
      </button>
      <span>{Math.round(zoom.scale * 100)}%</span>
      <button type="button" disabled={!zoom.canZoomIn} onClick={zoom.zoomIn}>
        +
      </button>
      <button
        type="button"
        aria-pressed={zoom.mode === "page-width"}
        onClick={() => zoom.zoomTo("page-width")}
      >
        Fit width
      </button>

      <span className="headless-separator" />
      <button type="button" disabled={!isReady} onClick={rotation.rotateClockwise}>
        Rotate
      </button>
      <button type="button" aria-pressed={cursor.mode === "hand"} onClick={cursor.toggle}>
        Hand tool
      </button>
    </div>
  );
}
