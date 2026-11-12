"use client";

import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { useSearch, type Search } from "./hooks.ts";
import { isImeConfirmation } from "./keyboard.ts";

/** Props for the search `<input>`. Spread them; add your own label. */
export interface SearchFieldInputProps {
  type: "search";
  value: string;
  "aria-keyshortcuts": string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export interface SearchFieldOptions {
  /** How long to wait after typing stops before searching, in ms. Default 250. */
  debounce?: number | undefined;
  /**
   * How long typing must have stopped before `announcement` speaks the result count, in
   * ms. Longer than `debounce`, so a screen reader doesn't read out a count for every
   * pause between keystrokes. Default 500.
   */
  announceDelay?: number | undefined;
  /** Called on Escape. Default: closes the search bar (`useSearch().setOpen(false)`). */
  onEscape?: (() => void) | undefined;
}

export interface SearchField {
  inputProps: SearchFieldInputProps;
  /** Short result count for display: "3 / 12", "3 / 12+" while scanning, "No results". */
  countLabel: string;
  /** The same as a sentence for screen readers: "Result 3 of 12, still searching". */
  spokenCountLabel: string;
  /**
   * For an `aria-live` region: the spoken count once the search is done and typing has
   * stopped (`announceDelay`), otherwise empty, so screen readers aren't flooded while
   * the user types or the count climbs.
   */
  announcement: string;
  /** Everything `useSearch()` returns, for previous / next buttons and the like. */
  search: Search;
}

/**
 * A search-as-you-type field: searches after typing pauses, Enter / Shift+Enter go to
 * the next / previous match (ignoring Enter that confirms an input method's composition),
 * Escape closes. Also provides the result count, for the eye and for screen readers.
 */
export function useSearchField(options: SearchFieldOptions = {}): SearchField {
  const { debounce = 250, announceDelay = 500 } = options;
  const search = useSearch();
  const [query, setQuery] = useState(search.query);
  const [isTyping, setIsTyping] = useState(false);
  const onEscape = options.onEscape ?? (() => search.setOpen(false));

  const startSearch = search.search;
  useEffect(() => {
    const timer = setTimeout(() => void startSearch(query), debounce);
    return () => clearTimeout(timer);
  }, [query, debounce, startSearch]);

  useEffect(() => {
    if (!isTyping) return;
    const timer = setTimeout(() => setIsTyping(false), announceDelay);
    return () => clearTimeout(timer);
    // Each keystroke restarts the wait: `query` isn't read, but its change is the trigger.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [query, isTyping, announceDelay]);

  const spoken = spokenCountLabel(search);
  return {
    inputProps: {
      type: "search",
      value: query,
      "aria-keyshortcuts": "Enter Shift+Enter",
      onChange: (event) => {
        setQuery(event.target.value);
        setIsTyping(true);
      },
      onKeyDown: (event) => {
        if (event.key === "Escape") {
          onEscape();
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (isImeConfirmation(event)) return;
          if (event.shiftKey) search.previous();
          else search.next();
        }
      },
    },
    countLabel: shortCountLabel(search),
    spokenCountLabel: spoken,
    announcement: search.status === "done" && !isTyping ? spoken : "",
    search,
  };
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
