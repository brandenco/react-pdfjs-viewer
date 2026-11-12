"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import {
  isSameRange,
  itemsBetween,
  NOTHING_VISIBLE,
  type ListLayout,
  type VisibleRange,
} from "../core/layout.ts";

export interface VirtualListOptions {
  /** How far beyond the viewport to render, as a fraction of its height. */
  overscan: number;
  /** Runs before paint whenever the layout changes, e.g. to keep the scroll position anchored. */
  onLayoutChange?: (previous: ListLayout | null, next: ListLayout, container: HTMLElement) => void;
  /** Runs at most once per frame while scrolling, and after layout changes. */
  onScroll?: (container: HTMLElement, layout: ListLayout) => void;
  onResize?: (container: HTMLElement) => void;
}

/**
 * Tracks which items of a virtualized list are in (or near) the scroll viewport.
 * The component only re-renders when that range changes, not on every scroll event.
 */
export function useVirtualList(
  containerRef: RefObject<HTMLElement | null>,
  layout: ListLayout,
  options: VirtualListOptions,
): VisibleRange {
  const [visibleRange, setVisibleRange] = useState(NOTHING_VISIBLE);
  const layoutRef = useRef<ListLayout | null>(null);

  // The callbacks may change every render; read the latest ones without re-subscribing.
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    const currentLayout = layoutRef.current;
    if (!container || !currentLayout) return;

    const { scrollTop, clientHeight } = container;
    const margin = clientHeight * optionsRef.current.overscan;
    const next = itemsBetween(currentLayout, scrollTop - margin, scrollTop + clientHeight + margin);
    setVisibleRange((previous) => (isSameRange(previous, next) ? previous : next));

    optionsRef.current.onScroll?.(container, currentLayout);
  }, [containerRef]);

  // New layout (zoom, page sizes loaded, resize): let the caller re-anchor, then recompute.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previous = layoutRef.current;
    layoutRef.current = layout;
    optionsRef.current.onLayoutChange?.(previous, layout, container);
    updateVisibleRange();
  }, [containerRef, layout, updateVisibleRange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    function onScroll(): void {
      if (frame) return; // already scheduled for this frame
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateVisibleRange();
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      optionsRef.current.onResize?.(container);
      updateVisibleRange();
    });

    container.addEventListener("scroll", onScroll, { passive: true });
    resizeObserver.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef, updateVisibleRange]);

  return visibleRange;
}
