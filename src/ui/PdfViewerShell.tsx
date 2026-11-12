"use client";

import "../viewer.css";
import {
  createContext,
  use,
  useEffect,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { useSearch } from "../headless/hooks.ts";

/** What the shell shares with the UI components inside it. */
interface ShellContextValue {
  /** Default `id` of `<PdfSidebar>`, so the toolbar's toggle can point at it. */
  sidebarId: string;
  /** Default `id` of `<PdfSearchBar>`, so the toolbar's search button can point at it. */
  searchBarId: string;
  /** The find shortcut, in `aria-keyshortcuts` syntax. */
  searchShortcut: string;
  rootRef: RefObject<HTMLDivElement | null>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

/** The shell around the current component, if any. UI components work without one. */
export function useShell(): ShellContextValue | null {
  return use(ShellContext);
}

/** The find shortcut in `aria-keyshortcuts` syntax (Ctrl+F, or Cmd+F on macOS). */
const FIND_SHORTCUT = "Control+F Meta+F";

export interface PdfViewerShellProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * The frame of the default viewer, for composing your own: a bordered column that
 * holds a toolbar and a `<PdfViewerBody>`. Cmd/Ctrl+F inside it opens the search bar,
 * and the toolbar, sidebar and search bar inside it are linked up for assistive tech.
 * Must be rendered inside a `<PdfViewerProvider>`.
 */
export function PdfViewerShell(props: PdfViewerShellProps): ReactNode {
  const { children, className, style } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarId = useId();
  const searchBarId = useId();
  const { setOpen: setSearchOpen } = useSearch();

  useFindShortcut(rootRef, () => setSearchOpen(true));

  const shell = useMemo(
    () => ({ sidebarId, searchBarId, searchShortcut: FIND_SHORTCUT, rootRef }),
    [sidebarId, searchBarId],
  );

  return (
    <ShellContext value={shell}>
      <div
        ref={rootRef}
        className={className ? `rpv-viewer ${className}` : "rpv-viewer"}
        style={style}
      >
        {children}
      </div>
    </ShellContext>
  );
}

export interface PdfViewerBodyProps {
  children?: ReactNode | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

/** The row under the toolbar: sidebar, pages, and the floating search bar. */
export function PdfViewerBody(props: PdfViewerBodyProps): ReactNode {
  const { children, className, style } = props;
  return (
    <div className={className ? `rpv-viewer-body ${className}` : "rpv-viewer-body"} style={style}>
      {children}
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
