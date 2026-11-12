"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

export interface Fullscreen {
  /** Whether `target` is the fullscreen element right now. */
  isFullscreen: boolean;
  /** `false` where the page may not go fullscreen (iPhone Safari, iframes without permission). */
  isSupported: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/**
 * Shows `target` (your viewer's root element) fullscreen. Not viewer state: it's the
 * browser's, so it also tracks the user leaving fullscreen with Escape. With a fit zoom
 * (`"page-fit"`, `"page-width"`), the pages re-fit to the new size automatically.
 */
export function useFullscreen(target: RefObject<Element | null>): Fullscreen {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => target.current !== null && document.fullscreenElement === target.current,
    () => false,
  );
  const isSupported = useSyncExternalStore(
    subscribe,
    () => document.fullscreenEnabled,
    () => false,
  );

  const enter = useCallback(async () => {
    const element = target.current;
    if (element && document.fullscreenElement !== element) await element.requestFullscreen();
  }, [target]);

  const exit = useCallback(async () => {
    if (target.current && document.fullscreenElement === target.current) {
      await document.exitFullscreen();
    }
  }, [target]);

  const toggle = useCallback(
    () => (target.current && document.fullscreenElement === target.current ? exit() : enter()),
    [target, enter, exit],
  );

  return { isFullscreen, isSupported, enter, exit, toggle };
}
