// `<PdfViewer>` assembled by hand from its exported pieces, with a wider sidebar of your
// own. No wiring props are needed: the pieces share state through the provider (the
// toolbar's search button opens the search bar, for example).
//
// `PdfViewerShell` adds the frame, Cmd/Ctrl+F for search, and links the toolbar to the
// sidebar and search bar for assistive tech. Without it the pieces still work; lay them
// out with your own CSS.
import type { ReactNode } from "react";
import {
  PdfPages,
  PdfThumbnails,
  PdfViewerProvider,
  useOutline,
  useSidebar,
  type PdfSource,
} from "react-pdfjs-viewer/headless";
import {
  PdfOutline,
  PdfSearchBar,
  PdfSidebar,
  PdfSidebarViewSwitch,
  PdfToolbar,
  PdfViewerBody,
  PdfViewerShell,
} from "react-pdfjs-viewer/ui";

import { workerSrc } from "../pdf-worker.ts";

export function ComposedViewer({ src }: { src: PdfSource }): ReactNode {
  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialSidebarOpen>
      <PdfViewerShell className="example-fill">
        <PdfToolbar />
        <PdfViewerBody>
          <Sidebar />
          <PdfPages gap={24} />
          <PdfSearchBar />
        </PdfViewerBody>
      </PdfViewerShell>
    </PdfViewerProvider>
  );
}

/** Thumbnails, or the outline for documents that have one: switch on `useSidebar().view`. */
function Sidebar(): ReactNode {
  const { view } = useSidebar();
  const outline = useOutline();
  const hasOutline = outline.items.length > 0;

  return (
    <PdfSidebar width={220}>
      {hasOutline && <PdfSidebarViewSwitch />}
      {hasOutline && view === "outline" ? <PdfOutline /> : <PdfThumbnails width={160} />}
    </PdfSidebar>
  );
}
