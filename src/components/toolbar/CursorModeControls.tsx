"use client";

import { useId, type ReactNode } from "react";

import type { CursorMode } from "../../core/types.ts";
import { useCursorMode } from "../../hooks.ts";
import { HandIcon, TextCursorIcon } from "./icons.tsx";

const CURSOR_MODES: { mode: CursorMode; label: string; icon: ReactNode }[] = [
  { mode: "text", label: "Text selection", icon: <TextCursorIcon /> },
  { mode: "hand", label: "Hand tool", icon: <HandIcon /> },
];

/**
 * A segmented control for picking the cursor mode. It's a one-of-several choice, so it
 * is a radio group (native radios): one Tab stop, arrow keys switch modes, and screen
 * readers announce "Text selection, radio button, 1 of 2, checked".
 */
export function CursorModeControls(): ReactNode {
  const cursor = useCursorMode();
  const groupName = useId();

  return (
    <fieldset className="rpv-segmented">
      <legend className="rpv-visually-hidden">Cursor mode</legend>
      {CURSOR_MODES.map(({ mode, label, icon }) => (
        <label key={mode} className="rpv-segment" title={label}>
          <input
            className="rpv-visually-hidden"
            type="radio"
            aria-label={label}
            name={groupName}
            value={mode}
            checked={cursor.mode === mode}
            onChange={() => cursor.setMode(mode)}
          />
          {icon}
        </label>
      ))}
    </fieldset>
  );
}
