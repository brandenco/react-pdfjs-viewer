"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from "react";

import { usePdfViewerState } from "../context.tsx";

export interface PdfSidebarProps {
  children?: ReactNode | undefined;
  /** Lets a toggle button point at the sidebar with `aria-controls`. */
  id?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Width when open, in px. Default 168. */
  width?: number | undefined;
}

/**
 * A container that slides open and closed with the sidebar state (`useSidebar()`).
 * Its children unmount once the close animation finishes, so a closed sidebar costs
 * nothing. The slide is skipped for users who prefer reduced motion.
 */
export function PdfSidebar(props: PdfSidebarProps): ReactNode {
  const { children, id, className, style, width = 168 } = props;
  const isOpen = usePdfViewerState((state) => state.isSidebarOpen);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Stays true through the close animation, so the content doesn't vanish mid-slide.
  const [showChildren, setShowChildren] = useState(isOpen);
  if (isOpen && !showChildren) setShowChildren(true);

  function onTransitionEnd(event: TransitionEvent<HTMLDivElement>): void {
    const isOwnTransition = event.target === event.currentTarget;
    if (isOwnTransition && !isOpen) setShowChildren(false);
  }

  // With no transition running (reduced motion, or the host app's CSS disabled it),
  // `transitionend` never fires, so check for that and hide the content directly.
  useEffect(() => {
    if (isOpen) return;
    const frame = requestAnimationFrame(() => {
      const animations = sidebarRef.current?.getAnimations({ subtree: true });
      if (animations?.length === 0) setShowChildren(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  return (
    <div
      ref={sidebarRef}
      id={id}
      className={className ? `rpv-sidebar ${className}` : "rpv-sidebar"}
      style={{ ...style, "--rpv-sidebar-width": `${width}px` } as CSSProperties}
      data-open={isOpen ? "" : undefined}
      inert={!isOpen}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="rpv-sidebar-inner">{showChildren && children}</div>
    </div>
  );
}
