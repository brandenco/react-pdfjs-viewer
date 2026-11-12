"use client";

import type { ReactNode } from "react";

import type { ZoomPreset } from "../../core/types.ts";
import { useZoom } from "../../hooks.ts";
import { MinusIcon, PlusIcon } from "./icons.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";

const ZOOM_PRESETS: { value: ZoomPreset; label: string }[] = [
  { value: "page-fit", label: "Fit page" },
  { value: "page-width", label: "Fit width" },
];

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** Zoom out / in buttons around a select with the fit presets and common zoom levels. */
export function ZoomControls(): ReactNode {
  const zoom = useZoom();

  // The select's value is the preset name, or the scale as a string.
  const selectedValue = zoom.mode === "custom" ? String(zoom.scale) : zoom.mode;
  // A scale reached through the +/- buttons may not be in the list; show it anyway.
  const isUnlistedScale = zoom.mode === "custom" && !ZOOM_LEVELS.includes(zoom.scale);

  function onSelect(value: string): void {
    const preset = ZOOM_PRESETS.find((option) => option.value === value);
    if (preset) zoom.zoomTo(preset.value);
    else zoom.setScale(Number(value));
  }

  return (
    <>
      <ToolbarButton label="Zoom out" disabled={!zoom.canZoomOut} onClick={zoom.zoomOut}>
        <MinusIcon />
      </ToolbarButton>

      <select
        className="rpv-select"
        aria-label="Zoom"
        value={selectedValue}
        onChange={(event) => onSelect(event.target.value)}
      >
        {ZOOM_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
        {isUnlistedScale && <option value={String(zoom.scale)}>{formatPercent(zoom.scale)}</option>}
        {ZOOM_LEVELS.map((level) => (
          <option key={level} value={String(level)}>
            {formatPercent(level)}
          </option>
        ))}
      </select>

      <ToolbarButton label="Zoom in" disabled={!zoom.canZoomIn} onClick={zoom.zoomIn}>
        <PlusIcon />
      </ToolbarButton>
    </>
  );
}

function formatPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
