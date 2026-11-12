"use client";

import type { ReactNode, RefObject } from "react";

import { usePdfViewerState } from "../headless/context.tsx";
import { useDownload, useRotation, useSearch, useSidebar } from "../headless/hooks.ts";
import { useFullscreen } from "../headless/use-fullscreen.ts";
import { usePrint } from "../headless/use-print.ts";
import type { StyleProps } from "./class-names.ts";
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

export interface SidebarToggleButtonProps extends StyleProps {
  /** `id` of the sidebar. Default: set by `<PdfViewerShell>`. */
  controls?: string | undefined;
}

/** Opens and closes the sidebar. */
export function SidebarToggleButton(props: SidebarToggleButtonProps): ReactNode {
  const sidebar = useSidebar();
  const shell = useShell();
  const sidebarId = props.controls ?? shell?.sidebarId;
  return (
    <ToolbarButton
      className={props.className}
      style={props.style}
      label="Sidebar"
      aria-expanded={sidebar.isOpen}
      aria-controls={sidebarId}
      onClick={sidebar.toggle}
    >
      <SidebarIcon />
    </ToolbarButton>
  );
}

export interface SearchToggleButtonProps extends StyleProps {
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
      className={props.className}
      style={props.style}
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
export function RotateButton(props: StyleProps): ReactNode {
  const { rotateClockwise } = useRotation();
  const hasDocument = usePdfViewerState((state) => state.document !== null);
  return (
    <ToolbarButton
      className={props.className}
      style={props.style}
      label="Rotate clockwise"
      disabled={!hasDocument}
      onClick={rotateClockwise}
    >
      <RotateClockwiseIcon />
    </ToolbarButton>
  );
}

/** Prints the document. Disabled when its permissions don't allow printing. */
export function PrintButton(props: StyleProps): ReactNode {
  const { print, canPrint, isPrinting, progress } = usePrint();
  return (
    <ToolbarButton
      className={props.className}
      style={props.style}
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

export interface FullscreenButtonProps extends StyleProps {
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
      className={props.className}
      style={props.style}
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
export function DownloadButton(props: StyleProps): ReactNode {
  const { download, canDownload, isDownloading } = useDownload();
  return (
    <ToolbarButton
      className={props.className}
      style={props.style}
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
