"use client";

import { useRef, type PointerEvent } from "react";

type PointerHandler = (event: PointerEvent<HTMLElement>) => void;

export interface HandPanHandlers {
  onPointerDown?: PointerHandler | undefined;
  onPointerMove?: PointerHandler | undefined;
  onPointerUp?: PointerHandler | undefined;
  onPointerCancel?: PointerHandler | undefined;
}

/**
 * Drag-to-scroll for the "hand" cursor mode. Spread the returned handlers onto the
 * scroll container. Touch is left alone, since touch already scrolls natively.
 */
export function useHandPan(isEnabled: boolean): HandPanHandlers {
  const dragStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>(null);
  if (!isEnabled) return {};

  function onPointerDown(event: PointerEvent<HTMLElement>): void {
    if (event.button !== 0 || event.pointerType === "touch") return;
    // Links (in the annotation layer) stay clickable in hand mode.
    if (event.target instanceof Element && event.target.closest("a[href]")) return;

    const container = event.currentTarget;
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    container.setPointerCapture(event.pointerId);
    container.dataset["dragging"] = "";
    // Cancelling pointerdown also stops the drag from selecting text.
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent<HTMLElement>): void {
    const start = dragStart.current;
    if (!start) return;

    const container = event.currentTarget;
    container.scrollLeft = start.scrollLeft - (event.clientX - start.x);
    container.scrollTop = start.scrollTop - (event.clientY - start.y);
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>): void {
    if (!dragStart.current) return;
    dragStart.current = null;

    const container = event.currentTarget;
    delete container.dataset["dragging"];
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
