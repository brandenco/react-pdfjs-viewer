"use client";

import { useEffect, useRef, type RefObject } from "react";

import { usePdfViewerStore } from "./context.tsx";

/**
 * Cmd+F / Ctrl+F while focus is inside `target` calls `onFind` instead of opening the
 * browser's find bar. By default it opens the search bar (`useSearch().setOpen(true)`).
 */
export function useFindShortcut(target: RefObject<HTMLElement | null>, onFind?: () => void): void {
  const store = usePdfViewerStore();
  const onFindRef = useRef(onFind);
  useEffect(() => {
    onFindRef.current = onFind;
  });

  useEffect(() => {
    const element = target.current;
    if (!element) return;

    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (onFindRef.current) onFindRef.current();
        else store.setSearchOpen(true);
      }
    }
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [target, store]);
}
