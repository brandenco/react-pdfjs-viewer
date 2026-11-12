"use client";

import { useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from "react";

import { usePageNavigation } from "./hooks.ts";
import { isImeConfirmation } from "./keyboard.ts";
import { usePageLabels } from "./use-page-labels.ts";

/** Props for the page number `<input>`. Spread them; add your own label. */
export interface PageFieldInputProps {
  value: string;
  disabled: boolean;
  inputMode: "numeric" | "text";
  enterKeyHint: "go";
  autoComplete: "off";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export interface PageField {
  inputProps: PageFieldInputProps;
  /** 1-based. */
  currentPage: number;
  numPages: number;
  /** Whether the field shows page labels ("iv") rather than numbers. */
  hasLabels: boolean;
  /** "of 40", or "(3 of 40)" alongside labels: the text to show next to the field. */
  countLabel: string;
}

/**
 * An editable "page N of M" field. It shows the current page (its label, for documents
 * with page labels), and while the user types it holds their text: Enter or leaving
 * the field goes to that page, Escape reverts. Accepts labels and page numbers. Enter
 * that confirms an input method's composition (Japanese, Chinese, …) is ignored.
 */
export function usePageField(): PageField {
  const { currentPage, numPages, goToPage } = usePageNavigation();
  const { labels, labelOf, pageNumberOf } = usePageLabels();
  // What the user is typing; `null` shows the current page instead.
  const [typed, setTyped] = useState<string | null>(null);

  function commit(): void {
    if (typed === null) return;
    const pageNumber = pageNumberOf(typed);
    if (pageNumber !== null) goToPage(pageNumber);
    setTyped(null);
  }

  return {
    inputProps: {
      value: typed ?? labelOf(currentPage),
      disabled: numPages === 0,
      inputMode: labels ? "text" : "numeric",
      enterKeyHint: "go",
      autoComplete: "off",
      onChange: (event) => setTyped(event.target.value),
      onFocus: (event) => event.target.select(),
      onBlur: commit,
      onKeyDown: (event) => {
        if (event.key === "Enter" && !isImeConfirmation(event)) commit();
        if (event.key === "Escape") setTyped(null);
      },
    },
    currentPage,
    numPages,
    hasLabels: labels !== null,
    countLabel: labels ? `(${currentPage} of ${numPages})` : `of ${numPages}`,
  };
}
