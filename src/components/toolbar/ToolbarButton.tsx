"use client";

// Styles for the default toolbar and search bar. Imported by their shared building
// block, so setups with a custom toolbar never load them.
import "../../viewer.css";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ToolbarButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "disabled" | "aria-label"
> {
  /** Accessible name; the buttons only show an icon. */
  label: string;
  /**
   * Sets `aria-disabled` rather than `disabled`, so the button stays focusable and
   * screen-reader users can still find it while tabbing.
   */
  disabled?: boolean | undefined;
}

export function ToolbarButton(props: ToolbarButtonProps): ReactNode {
  const { label, disabled = false, onClick, ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      type="button"
      className="rpv-button"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    />
  );
}
