"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { withClassName } from "./class-names.ts";
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
  const { label, disabled = false, onClick, className, ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      type="button"
      className={withClassName("rpv-button", className)}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    />
  );
}
