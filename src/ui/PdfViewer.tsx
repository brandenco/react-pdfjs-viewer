"use client";

import type { CSSProperties, ReactNode } from "react";

import { PdfViewerProvider, type PdfViewerProviderProps } from "../headless/context.tsx";
import { useSidebar } from "../headless/hooks.ts";
import { PdfPages, type PdfPagesProps } from "../headless/PdfPages.tsx";
import { PdfThumbnails } from "../headless/PdfThumbnails.tsx";
import { useOutline } from "../headless/use-outline.ts";
import { PdfOutline } from "./PdfOutline.tsx";
import { PdfSearchBar } from "./PdfSearchBar.tsx";
import { PdfSidebar } from "./PdfSidebar.tsx";
import { PdfSidebarViewSwitch } from "./PdfSidebarViewSwitch.tsx";
import { PdfToolbar } from "./PdfToolbar.tsx";
import { PdfViewerBody, PdfViewerShell } from "./PdfViewerShell.tsx";

export interface PdfViewerProps extends Omit<PdfViewerProviderProps, "children"> {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Replaces the default toolbar. It's rendered inside the provider, so it can use the hooks. */
  toolbar?: ReactNode | undefined;
  pagesProps?: PdfPagesProps | undefined;
  /** Thumbnail image width, in px. Default 120. */
  thumbnailWidth?: number | undefined;
}

/** Horizontal padding the sidebar adds around its thumbnails, in px. */
const SIDEBAR_PADDING = 48;

/** Thumbnails, plus a switch to the outline for documents that have one. */
function DefaultSidebarContent({ thumbnailWidth }: { thumbnailWidth: number }): ReactNode {
  const { view } = useSidebar();
  const outline = useOutline();
  if (outline.items.length === 0) return <PdfThumbnails width={thumbnailWidth} />;

  return (
    <>
      <PdfSidebarViewSwitch />
      {view === "outline" ? <PdfOutline /> : <PdfThumbnails width={thumbnailWidth} />}
    </>
  );
}

/**
 * The complete viewer: toolbar, sliding sidebar (thumbnails and outline), pages and
 * search bar. It's
 * made of the same public pieces you can compose yourself (see the README).
 */
export function PdfViewer(props: PdfViewerProps): ReactNode {
  const { className, style, toolbar, pagesProps, thumbnailWidth = 120, ...providerProps } = props;
  return (
    <PdfViewerProvider {...providerProps}>
      <PdfViewerShell className={className} style={style}>
        {toolbar ?? <PdfToolbar />}
        <PdfViewerBody>
          <PdfSidebar width={thumbnailWidth + SIDEBAR_PADDING}>
            <DefaultSidebarContent thumbnailWidth={thumbnailWidth} />
          </PdfSidebar>
          <PdfPages {...pagesProps} />
          <PdfSearchBar />
        </PdfViewerBody>
      </PdfViewerShell>
    </PdfViewerProvider>
  );
}
