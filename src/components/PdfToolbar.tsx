"use client";

import type { ReactNode } from "react";

import { useDownload, useSidebar } from "../hooks.ts";
import { CursorModeControls } from "./toolbar/CursorModeControls.tsx";
import { DownloadIcon, SearchIcon, SidebarIcon } from "./toolbar/icons.tsx";
import { PageControls } from "./toolbar/PageControls.tsx";
import { ToolbarButton } from "./toolbar/ToolbarButton.tsx";
import { ZoomControls } from "./toolbar/ZoomControls.tsx";

export interface PdfToolbarProps {
  isSearchOpen: boolean;
  onSearchOpenChange: (isOpen: boolean) => void;
  /** `id` of the search bar, linked with `aria-controls` while it's open. */
  searchBarId?: string | undefined;
  /** `id` of the thumbnail sidebar, linked with `aria-controls`. */
  sidebarId?: string | undefined;
  /** Keyboard shortcut that opens search, announced via `aria-keyshortcuts`. */
  searchShortcut?: string | undefined;
}

/**
 * The default toolbar: thumbnails and page controls on the left, zoom in the middle,
 * cursor mode, search and download on the right. It only uses the public hooks, so it
 * doubles as an example for building your own.
 *
 * Deliberately not `role="toolbar"`: that pattern moves focus between controls with the
 * Left/Right arrow keys, which the page number field and the zoom select need for
 * themselves. WAI-ARIA Authoring Practices advise against toolbars containing more than
 * one such control, so the controls keep their normal Tab order instead.
 */
export function PdfToolbar(props: PdfToolbarProps): ReactNode {
  const { isSearchOpen, onSearchOpenChange, searchBarId, sidebarId, searchShortcut } = props;
  const sidebar = useSidebar();
  const { download, canDownload, isDownloading } = useDownload();

  return (
    <div className="rpv-toolbar">
      <div className="rpv-toolbar-group">
        <ToolbarButton
          label="Thumbnails"
          aria-expanded={sidebar.isOpen}
          aria-controls={sidebarId}
          onClick={sidebar.toggle}
        >
          <SidebarIcon />
        </ToolbarButton>
        <span className="rpv-toolbar-separator" />
        <PageControls />
      </div>

      <div className="rpv-toolbar-group">
        <ZoomControls />
      </div>

      <div className="rpv-toolbar-group" data-align="end">
        <CursorModeControls />
        <span className="rpv-toolbar-separator" />
        <ToolbarButton
          label="Search"
          aria-expanded={isSearchOpen}
          // Only reference the search bar while it exists in the DOM.
          aria-controls={isSearchOpen ? searchBarId : undefined}
          aria-keyshortcuts={searchShortcut}
          onClick={() => onSearchOpenChange(!isSearchOpen)}
        >
          <SearchIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Download"
          disabled={!canDownload || isDownloading}
          // reportError surfaces a failed download like any uncaught error, without
          // leaving an unhandled promise rejection behind.
          onClick={() => {
            download().catch(reportError);
          }}
        >
          <DownloadIcon />
        </ToolbarButton>
      </div>
    </div>
  );
}
