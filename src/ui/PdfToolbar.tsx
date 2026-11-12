"use client";

import type { ReactNode } from "react";

import { withClassName, type StyleProps } from "./class-names.ts";
import { CursorModeSwitch } from "./CursorModeSwitch.tsx";
import { PageControls } from "./PageControls.tsx";
import {
  DownloadButton,
  FullscreenButton,
  PrintButton,
  RotateButton,
  SearchToggleButton,
  SidebarToggleButton,
} from "./ToolbarButtons.tsx";
import { ZoomControls } from "./ZoomControls.tsx";

export interface PdfToolbarProps extends StyleProps {
  /** Controls the search button's state yourself. Default: the shared `useSearch().isOpen`. */
  isSearchOpen?: boolean | undefined;
  /** Called by the search button. Default: `useSearch().setOpen`. */
  onSearchOpenChange?: ((isOpen: boolean) => void) | undefined;
  /** `id` of the search bar, linked with `aria-controls` while it's open. Default: set by `<PdfViewerShell>`. */
  searchBarId?: string | undefined;
  /** `id` of the sidebar, linked with `aria-controls`. Default: set by `<PdfViewerShell>`. */
  sidebarId?: string | undefined;
  /** Keyboard shortcut that opens search, announced via `aria-keyshortcuts`. Default: set by `<PdfViewerShell>`. */
  searchShortcut?: string | undefined;
}

/**
 * The default toolbar: sidebar and page controls on the left, zoom in the middle,
 * cursor mode, search, rotate, full screen, print and download on the right. Every
 * control is exported on its own, and only uses public hooks, so a custom toolbar can
 * reuse any of them.
 *
 * Deliberately not `role="toolbar"`: that pattern moves focus between controls with the
 * Left/Right arrow keys, which the page number field and the zoom select need for
 * themselves. WAI-ARIA Authoring Practices advise against toolbars containing more than
 * one such control, so the controls keep their normal Tab order instead.
 */
export function PdfToolbar(props: PdfToolbarProps): ReactNode {
  const { isSearchOpen, onSearchOpenChange, searchBarId, sidebarId, searchShortcut } = props;

  return (
    <div className={withClassName("rpv-toolbar", props.className)} style={props.style}>
      <div className="rpv-toolbar-group">
        <SidebarToggleButton controls={sidebarId} />
        <span className="rpv-toolbar-separator" />
        <PageControls />
      </div>

      <div className="rpv-toolbar-group">
        <ZoomControls />
      </div>

      <div className="rpv-toolbar-group" data-align="end">
        <CursorModeSwitch />
        <span className="rpv-toolbar-separator" />
        <SearchToggleButton
          isOpen={isSearchOpen}
          onOpenChange={onSearchOpenChange}
          controls={searchBarId}
          shortcut={searchShortcut}
        />
        <RotateButton />
        <FullscreenButton />
        <PrintButton />
        <DownloadButton />
      </div>
    </div>
  );
}
