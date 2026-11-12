"use client";

import type { ReactNode, RefObject } from "react";

import { usePdfViewerState } from "../headless/context.tsx";
import { useDownload, useRotation, useSearch, useSidebar } from "../headless/hooks.ts";
import { useFullscreen } from "../headless/use-fullscreen.ts";
import { usePrint } from "../headless/use-print.ts";
import {
  DownloadIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  PrintIcon,
  RotateClockwiseIcon,
  SearchIcon,
  SidebarIcon,
} from "./icons.tsx";
import { useShell } from "./PdfViewerShell.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

// The default toolbar's buttons, one component each, so a custom toolbar can reuse any
// of them. Each one only uses public hooks. Inside a <PdfViewerShell> they're linked to
// the sidebar and search bar with aria-controls.

// `reportError` surfaces a failed action like any uncaught error, without leaving an
// unhandled promise rejection behind.

/** Opens and closes the sidebar. */
export function SidebarToggleButton(props: { controls?: string | undefined }): ReactNode {
  const sidebar = useSidebar();
  const shell = useShell();
  const sidebarId = props.controls ?? shell?.sidebarId;
  return (
    <ToolbarButton
      label="Sidebar"
      aria-expanded={sidebar.isOpen}
      aria-controls={sidebarId}
      onClick={sidebar.toggle}
    >
      <SidebarIcon />
    </ToolbarButton>
  );
}

export interface SearchToggleButtonProps {
  /** Default: the shared `useSearch().isOpen`. */
  isOpen?: boolean | undefined;
  /** Default: `useSearch().setOpen`. */
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
  /** `id` of the search bar. Default: set by `<PdfViewerShell>`. */
  controls?: string | undefined;
  /** Announced via `aria-keyshortcuts`. Default: set by `<PdfViewerShell>`. */
  shortcut?: string | undefined;
}

/** Opens and closes the search bar. */
export function SearchToggleButton(props: SearchToggleButtonProps): ReactNode {
  const search = useSearch();
  const shell = useShell();
  const isOpen = props.isOpen ?? search.isOpen;
  const onOpenChange = props.onOpenChange ?? search.setOpen;
  const searchBarId = props.controls ?? shell?.searchBarId;
  return (
    <ToolbarButton
      label="Search"
      aria-expanded={isOpen}
      // Only reference the search bar while it exists in the DOM.
      aria-controls={isOpen ? searchBarId : undefined}
      aria-keyshortcuts={props.shortcut ?? shell?.searchShortcut}
      onClick={() => onOpenChange(!isOpen)}
    >
      <SearchIcon />
    </ToolbarButton>
  );
}

/** Rotates every page a quarter turn clockwise. */
export function RotateButton(): ReactNode {
  const { rotateClockwise } = useRotation();
  const hasDocument = usePdfViewerState((state) => state.document !== null);
  return (
    <ToolbarButton label="Rotate clockwise" disabled={!hasDocument} onClick={rotateClockwise}>
      <RotateClockwiseIcon />
    </ToolbarButton>
  );
}

/** Prints the document. Disabled when its permissions don't allow printing. */
export function PrintButton(): ReactNode {
  const { print, canPrint, isPrinting, progress } = usePrint();
  return (
    <ToolbarButton
      label={
        progress
          ? `Preparing to print: page ${progress.pagesRendered} of ${progress.pageCount}`
          : "Print"
      }
      disabled={!canPrint || isPrinting}
      aria-busy={isPrinting}
      onClick={() => {
        print().catch(reportError);
      }}
    >
      <PrintIcon />
    </ToolbarButton>
  );
}

export interface FullscreenButtonProps {
  /** The element to show fullscreen. Default: the surrounding `<PdfViewerShell>`. */
  target?: RefObject<Element | null> | undefined;
}

/** Toggles fullscreen. Renders nothing where fullscreen isn't available. */
export function FullscreenButton(props: FullscreenButtonProps): ReactNode {
  const shell = useShell();
  const fullscreen = useFullscreen(props.target ?? shell?.rootRef ?? NO_TARGET);
  if (!fullscreen.isSupported || (!props.target && !shell)) return null;
  return (
    <ToolbarButton
      label="Full screen"
      aria-pressed={fullscreen.isFullscreen}
      onClick={() => {
        fullscreen.toggle().catch(reportError);
      }}
    >
      {fullscreen.isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
    </ToolbarButton>
  );
}

const NO_TARGET: RefObject<Element | null> = { current: null };

/** Saves the original PDF. */
export function DownloadButton(): ReactNode {
  const { download, canDownload, isDownloading } = useDownload();
  return (
    <ToolbarButton
      label="Download"
      disabled={!canDownload || isDownloading}
      onClick={() => {
        download().catch(reportError);
      }}
    >
      <DownloadIcon />
    </ToolbarButton>
  );
}
