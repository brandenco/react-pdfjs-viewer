"use client";

import { useId, useState, type ReactNode } from "react";

import { usePageNavigation } from "../headless/hooks.ts";
import { usePageLabels } from "../headless/use-page-labels.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";
import { isImeConfirmation } from "./keyboard.ts";
import { ToolbarButton } from "./ToolbarButton.tsx";

/**
 * Previous / next buttons around an editable "page N of M" field. For documents with
 * page labels, the field shows and accepts labels ("iv"), with the number alongside.
 */
export function PageControls(): ReactNode {
  const navigation = usePageNavigation();
  const { labels, labelOf, pageNumberOf } = usePageLabels();
  // What the user is typing; `null` shows the current page instead.
  const [typedPage, setTypedPage] = useState<string | null>(null);
  const pageCountId = useId();

  function goToTypedPage(): void {
    if (typedPage === null) return;
    const pageNumber = pageNumberOf(typedPage);
    if (pageNumber !== null) navigation.goToPage(pageNumber);
    setTypedPage(null);
  }

  return (
    <>
      <ToolbarButton
        label="Previous page"
        disabled={!navigation.canGoPrevious}
        onClick={navigation.previousPage}
      >
        <ChevronLeftIcon />
      </ToolbarButton>

      <input
        className="rpv-input rpv-page-input"
        aria-label="Page number"
        // Read out with the field, so screen readers hear "Page number, 12, of 5000".
        aria-describedby={pageCountId}
        inputMode={labels ? "text" : "numeric"}
        enterKeyHint="go"
        autoComplete="off"
        value={typedPage ?? labelOf(navigation.currentPage)}
        disabled={navigation.numPages === 0}
        onChange={(event) => setTypedPage(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={goToTypedPage}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !isImeConfirmation(event)) goToTypedPage();
          if (event.key === "Escape") setTypedPage(null);
        }}
      />
      <span id={pageCountId} className="rpv-page-count">
        {labels
          ? `(${navigation.currentPage} of ${navigation.numPages})`
          : `of ${navigation.numPages}`}
      </span>

      <ToolbarButton
        label="Next page"
        disabled={!navigation.canGoNext}
        onClick={navigation.nextPage}
      >
        <ChevronRightIcon />
      </ToolbarButton>
    </>
  );
}
