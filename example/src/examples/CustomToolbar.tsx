// Your own toolbar from the default toolbar's parts. Each part only uses public hooks,
// and `ToolbarButton` gives your own buttons the same look and accessible behavior.
//
// Parts: SidebarToggleButton, PageControls, ZoomControls, CursorModeSwitch,
// SearchToggleButton, RotateButton, FullscreenButton, PrintButton, DownloadButton,
// MoreActionsMenu (rotate, full screen, print and download in a menu) and ToolbarButton.
import type { ReactNode } from "react";
import { useZoom, type PdfSource } from "react-pdfjs-viewer/headless";
import {
  CursorModeSwitch,
  DownloadButton,
  PageControls,
  PdfViewer,
  PrintButton,
  SearchToggleButton,
  SidebarToggleButton,
  ToolbarButton,
  ZoomControls,
} from "react-pdfjs-viewer/ui";

import { workerSrc } from "../pdf-worker.ts";

export function CustomToolbar({ src }: { src: PdfSource }): ReactNode {
  // `toolbar` is rendered inside the provider, so it can use the hooks.
  return (
    <PdfViewer className="example-fill" src={src} workerSrc={workerSrc} toolbar={<MyToolbar />} />
  );
}

function MyToolbar(): ReactNode {
  const { setScale, scale } = useZoom();
  return (
    // The default toolbar's class, for its look; your own works just as well.
    <div className="rpv-toolbar">
      <div className="rpv-toolbar-group">
        <SidebarToggleButton />
        <PageControls />
      </div>
      <div className="rpv-toolbar-group">
        <ZoomControls />
        <ToolbarButton label="Actual size" aria-pressed={scale === 1} onClick={() => setScale(1)}>
          1:1
        </ToolbarButton>
      </div>
      <div className="rpv-toolbar-group" data-align="end">
        <CursorModeSwitch />
        <SearchToggleButton />
        <PrintButton />
        <DownloadButton />
      </div>
    </div>
  );
}
