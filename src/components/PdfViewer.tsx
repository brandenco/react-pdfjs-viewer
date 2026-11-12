"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { PdfViewerProvider, type PdfViewerProviderProps } from "../context.tsx";
import { useSearch } from "../hooks.ts";
import { PdfPages, type PdfPagesProps } from "./PdfPages.tsx";
import { PdfSearchBar } from "./PdfSearchBar.tsx";
import { PdfSidebar } from "./PdfSidebar.tsx";
import { PdfThumbnails } from "./PdfThumbnails.tsx";
import { PdfToolbar } from "./PdfToolbar.tsx";

export interface PdfViewerProps extends Omit<PdfViewerProviderProps, "children"> {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Replaces the default toolbar. It's rendered inside the provider, so it can use the hooks. */
  toolbar?: ReactNode | undefined;
  pagesProps?: PdfPagesProps | undefined;
  /** Thumbnail image width, in px. Default 120. */
  thumbnailWidth?: number | undefined;
}

/** The find shortcut in `aria-keyshortcuts` syntax (Ctrl+F, or Cmd+F on macOS). */
const FIND_SHORTCUT = "Control+F Meta+F";

/** Horizontal padding the sidebar adds around its thumbnails, in px. */
const SIDEBAR_PADDING = 48;

/**
 * The complete viewer: toolbar, sliding thumbnail sidebar, and pages. For a custom
 * layout, compose `PdfViewerProvider`, `PdfPages`, `PdfSidebar` and `PdfThumbnails`.
 */
export function PdfViewer(props: PdfViewerProps): ReactNode {
  const { className, style, toolbar, pagesProps, thumbnailWidth = 120, ...providerProps } = props;
  return (
    <PdfViewerProvider {...providerProps}>
      <ViewerLayout
        className={className}
        style={style}
        toolbar={toolbar}
        pagesProps={pagesProps}
        thumbnailWidth={thumbnailWidth}
      />
    </PdfViewerProvider>
  );
}

interface ViewerLayoutProps {
  className: string | undefined;
  style: CSSProperties | undefined;
  toolbar: ReactNode;
  pagesProps: PdfPagesProps | undefined;
  thumbnailWidth: number;
}

function ViewerLayout(props: ViewerLayoutProps): ReactNode {
  const { className, style, toolbar, pagesProps, thumbnailWidth } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarId = useId();
  const searchBarId = useId();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { clear: clearSearch } = useSearch();

  function setSearchOpen(isOpen: boolean): void {
    setIsSearchOpen(isOpen);
    if (!isOpen) clearSearch();
  }

  useFindShortcut(rootRef, () => setIsSearchOpen(true));

  return (
    <div
      ref={rootRef}
      className={className ? `rpv-viewer ${className}` : "rpv-viewer"}
      style={style}
    >
      {toolbar ?? (
        <PdfToolbar
          isSearchOpen={isSearchOpen}
          onSearchOpenChange={setSearchOpen}
          searchBarId={searchBarId}
          sidebarId={sidebarId}
          searchShortcut={FIND_SHORTCUT}
        />
      )}
      <div className="rpv-viewer-body">
        <PdfSidebar id={sidebarId} width={thumbnailWidth + SIDEBAR_PADDING}>
          <PdfThumbnails width={thumbnailWidth} />
        </PdfSidebar>
        <PdfPages {...pagesProps} />
        {isSearchOpen && <PdfSearchBar id={searchBarId} onClose={() => setSearchOpen(false)} />}
      </div>
    </div>
  );
}

/** Calls `onFind` for Cmd+F / Ctrl+F while focus is inside `rootRef`, instead of the browser's find. */
function useFindShortcut(rootRef: RefObject<HTMLElement | null>, onFind: () => void): void {
  const onFindRef = useRef(onFind);
  useEffect(() => {
    onFindRef.current = onFind;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        onFindRef.current();
      }
    }
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
