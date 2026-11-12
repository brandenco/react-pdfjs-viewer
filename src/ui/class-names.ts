import type { CSSProperties } from "react";

/** Our class name, plus the caller's if they passed one. */
export function withClassName(base: string, className: string | undefined): string {
  return className ? `${base} ${className}` : base;
}

/**
 * Props every UI component accepts, to style it from outside. Taking both means
 * `{...stylex.props(styles.x)}` and similar helpers work as-is.
 */
export interface StyleProps {
  /** Added to the component's own class (never replaces it). */
  className?: string | undefined;
  /** Inline styles for the component's root element. */
  style?: CSSProperties | undefined;
}
