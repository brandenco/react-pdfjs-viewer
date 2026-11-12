"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { usePdfViewerState } from "../headless/context.tsx";
import { useSearch, type Search } from "../headless/hooks.ts";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "./icons.tsx";
import { isImeConfirmation } from "./keyboard.ts";
import { useShell } from "./PdfViewerShell.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

export interface PdfSearchBarProps {
  /**
   * Called by Escape and the close button. When given, you control when the bar is
   * shown. When omitted, the bar follows the shared `useSearch().isOpen` state: it
   * renders only while open, and closing it calls `setOpen(false)`.
   */
  onClose?: (() => void) | undefined;
  /** Lets a toggle button point at the search bar with `aria-controls`. */
  id?: string | undefined;
  /** How long to wait after typing stops before searching, in ms. Default 250. */
  debounce?: number | undefined;
}

/** Search-as-you-type box with a match counter and previous / next match buttons. */
export function PdfSearchBar(props: PdfSearchBarProps): ReactNode {
  const isOpen = usePdfViewerState((state) => state.isSearchOpen);
  if (!props.onClose && !isOpen) return null;
  return <SearchBar {...props} />;
}

function SearchBar({
  onClose: onCloseProp,
  debounce = 250,
  ...props
}: PdfSearchBarProps): ReactNode {
  const search = useSearch();
  const shell = useShell();
  const id = props.id ?? shell?.searchBarId;
  const onClose = onCloseProp ?? (() => search.setOpen(false));
  const [query, setQuery] = useState(search.query);
  const barRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const countId = useId();

  useFocusWhileOpen(barRef, inputRef);

  const startSearch = search.search;
  useEffect(() => {
    const timer = setTimeout(() => void startSearch(query), debounce);
    return () => clearTimeout(timer);
  }, [query, debounce, startSearch]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (isImeConfirmation(event)) return;
      if (event.shiftKey) search.previous();
      else search.next();
    }
  }

  const hasMatches = search.matches.length > 0;

  return (
    <search ref={barRef} id={id} className="rpv-search-bar">
      <input
        ref={inputRef}
        className="rpv-input"
        type="search"
        aria-label="Find in document"
        aria-describedby={countId}
        aria-keyshortcuts="Enter Shift+Enter"
        placeholder="Find in document"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />

      <span id={countId} className="rpv-search-count">
        {/* "3 / 12+" for the eye, "Result 3 of 12, still searching" for screen readers. */}
        <span aria-hidden="true">{shortCountLabel(search)}</span>
        <span className="rpv-visually-hidden">{spokenCountLabel(search)}</span>
      </span>
      {/* Announced only once the search finishes; the count changes rapidly while scanning. */}
      <span className="rpv-visually-hidden" aria-live="polite">
        {search.status === "done" ? spokenCountLabel(search) : ""}
      </span>

      <ToolbarButton label="Previous match" disabled={!hasMatches} onClick={search.previous}>
        <ChevronUpIcon />
      </ToolbarButton>
      <ToolbarButton label="Next match" disabled={!hasMatches} onClick={search.next}>
        <ChevronDownIcon />
      </ToolbarButton>
      <ToolbarButton label="Close search" onClick={onClose}>
        <CloseIcon />
      </ToolbarButton>
    </search>
  );
}

/**
 * Focuses the input when the bar opens, and when it closes, returns focus to whatever
 * had it before (the Search button, or the page if it was opened with Cmd/Ctrl+F),
 * so keyboard and screen-reader users don't end up at the top of the page.
 */
function useFocusWhileOpen(
  barRef: RefObject<HTMLElement | null>,
  inputRef: RefObject<HTMLInputElement | null>,
): void {
  // A layout effect, so its cleanup runs while the bar is still in the DOM.
  useLayoutEffect(() => {
    const previouslyFocused = document.activeElement;
    inputRef.current?.focus();

    const bar = barRef.current;
    return () => {
      const focusIsInBar = bar?.contains(document.activeElement) ?? false;
      if (focusIsInBar && previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [barRef, inputRef]);
}

/** "3 / 12", with a "+" while pages are still being scanned. */
function shortCountLabel(search: Search): string {
  if (search.query.trim() === "") return "";

  const total = search.matches.length;
  const isSearching = search.status === "searching";
  if (total === 0) return isSearching ? "…" : "No results";

  const position = search.activeIndex === -1 ? "–" : String(search.activeIndex + 1);
  return `${position} / ${total}${isSearching ? "+" : ""}`;
}

/** The same count as a sentence, e.g. "Result 3 of 12, still searching". */
function spokenCountLabel(search: Search): string {
  if (search.query.trim() === "") return "";

  const total = search.matches.length;
  const isSearching = search.status === "searching";
  if (total === 0) return isSearching ? "Searching" : "No results";

  const position = search.activeIndex === -1 ? "" : `Result ${search.activeIndex + 1} of `;
  const count = position ? String(total) : `${total} results`;
  return `${position}${count}${isSearching ? ", still searching" : ""}`;
}
