"use client";

import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

import { usePdfViewerState } from "../headless/context.tsx";
import { useSearchField } from "../headless/use-search-field.ts";
import { withClassName, type StyleProps } from "./class-names.ts";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "./icons.tsx";
import { useShell } from "./PdfViewerShell.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

export interface PdfSearchBarProps extends StyleProps {
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

/**
 * Search-as-you-type box with a match counter and previous / next match buttons, built
 * on `useSearchField()`.
 */
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
  const shell = useShell();
  const id = props.id ?? shell?.searchBarId;
  const field = useSearchField({ debounce, onEscape: onCloseProp });
  const { search } = field;
  const onClose = onCloseProp ?? (() => search.setOpen(false));
  const barRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const countId = useId();

  useFocusWhileOpen(barRef, inputRef);

  const hasMatches = search.matches.length > 0;

  return (
    <search
      ref={barRef}
      id={id}
      className={withClassName("rpv-search-bar", props.className)}
      style={props.style}
    >
      <input
        {...field.inputProps}
        ref={inputRef}
        className="rpv-input"
        aria-label="Find in document"
        aria-describedby={countId}
        placeholder="Find in document"
      />

      <span id={countId} className="rpv-search-count">
        {/* "3 / 12+" for the eye, "Result 3 of 12, still searching" for screen readers. */}
        <span aria-hidden="true">{field.countLabel}</span>
        <span className="rpv-visually-hidden">{field.spokenCountLabel}</span>
      </span>
      {/* Announced only once the search finishes; the count changes rapidly while scanning. */}
      <span className="rpv-visually-hidden" aria-live="polite">
        {field.announcement}
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
