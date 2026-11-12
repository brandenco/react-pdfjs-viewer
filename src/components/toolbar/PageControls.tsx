"use client";

import { useId, useState, type ReactNode } from "react";

import { usePageNavigation } from "../../hooks.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";
import { isImeConfirmation } from "./keyboard.ts";
import { ToolbarButton } from "./ToolbarButton.tsx";

/** Previous / next buttons around an editable "page N of M" field. */
export function PageControls(): ReactNode {
  const navigation = usePageNavigation();
  // What the user is typing; `null` shows the current page instead.
  const [typedPage, setTypedPage] = useState<string | null>(null);
  const pageCountId = useId();

  function goToTypedPage(): void {
    if (typedPage === null) return;
    const pageNumber = Number.parseInt(typedPage, 10);
    if (Number.isFinite(pageNumber)) navigation.goToPage(pageNumber);
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
        inputMode="numeric"
        enterKeyHint="go"
        autoComplete="off"
        value={typedPage ?? String(navigation.currentPage)}
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
        of {navigation.numPages}
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
