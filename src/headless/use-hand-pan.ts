"use client";

import { useEffect, useRef, type PointerEvent } from "react";

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
  const dragStart = useRef<{
    container: HTMLElement;
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  }>(null);

  // Switched off mid-drag: the handlers that would end the drag are gone, so end it here.
  useEffect(() => {
    if (isEnabled) return;
    const start = dragStart.current;
    if (!start) return;
    dragStart.current = null;
    endDrag(start.container, start.pointerId);
  }, [isEnabled]);

  if (!isEnabled) return {};

  function onPointerDown(event: PointerEvent<HTMLElement>): void {
    if (event.button !== 0 || event.pointerType === "touch") return;
    // Links (in the annotation layer) stay clickable in hand mode, and the app's page
    // overlays handle their own input (it only gets the pointer where the app asked).
    if (event.target instanceof Element && event.target.closest("a[href], .rpv-page-overlay")) {
      return;
    }

    const container = event.currentTarget;
    dragStart.current = {
      container,
      pointerId: event.pointerId,
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
    endDrag(event.currentTarget, event.pointerId);
  }

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}

function endDrag(container: HTMLElement, pointerId: number): void {
  delete container.dataset["dragging"];
  if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
}
