import type { KeyboardEvent } from "react";

/**
 * Whether this Enter key press confirms text being composed with an input method
 * (Japanese, Chinese, Korean, …). Those presses must not trigger our own Enter action.
 */
export function isImeConfirmation(event: KeyboardEvent): boolean {
  // Safari clears `isComposing` before the confirming keydown reaches handlers, but
  // still reports the deprecated keyCode 229 ("processed by an input method") for it.
  // oxlint-disable-next-line typescript/no-deprecated
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
