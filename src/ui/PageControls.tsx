"use client";

import { useId, type ReactNode } from "react";

import { usePageNavigation } from "../headless/hooks.ts";
import { usePageField } from "../headless/use-page-field.ts";
import { withClassName, type StyleProps } from "./class-names.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

/**
 * Previous / next buttons around an editable "page N of M" field (`usePageField()`).
 * For documents with page labels, the field shows and accepts labels ("iv"), with the
 * number alongside.
 */
export function PageControls(props: StyleProps): ReactNode {
  const navigation = usePageNavigation();
  const field = usePageField();
  const pageCountId = useId();

  return (
    <div className={withClassName("rpv-page-controls", props.className)} style={props.style}>
      <ToolbarButton
        label="Previous page"
        disabled={!navigation.canGoPrevious}
        onClick={navigation.previousPage}
      >
        <ChevronLeftIcon />
      </ToolbarButton>

      <input
        {...field.inputProps}
        className="rpv-input rpv-page-input"
        aria-label="Page number"
        // Read out with the field, so screen readers hear "Page number, 12, of 5000".
        aria-describedby={pageCountId}
      />
      <span id={pageCountId} className="rpv-page-count">
        {field.countLabel}
      </span>

      <ToolbarButton
        label="Next page"
        disabled={!navigation.canGoNext}
        onClick={navigation.nextPage}
      >
        <ChevronRightIcon />
      </ToolbarButton>
    </div>
  );
}
