"use client";

import "../viewer.css";
import { useId, type ReactNode } from "react";

import type { SidebarView } from "../core/types.ts";
import { useSidebar } from "../headless/hooks.ts";

const VIEWS: { view: SidebarView; label: string }[] = [
  { view: "thumbnails", label: "Pages" },
  { view: "outline", label: "Outline" },
];

export interface PdfSidebarViewSwitchProps {
  /** The views to offer, in order. Default: thumbnails and outline. */
  views?: readonly SidebarView[] | undefined;
}

/**
 * Picks what the sidebar shows (`useSidebar().view`): page thumbnails or the outline.
 * Looks like tabs, but is a radio group (native radios): one Tab stop, arrow keys move
 * between views, and nothing else on the page changes focus.
 */
export function PdfSidebarViewSwitch(props: PdfSidebarViewSwitchProps): ReactNode {
  const { views } = props;
  const sidebar = useSidebar();
  const groupName = useId();
  const options = views ? VIEWS.filter(({ view }) => views.includes(view)) : VIEWS;

  return (
    <fieldset className="rpv-sidebar-views">
      <legend className="rpv-visually-hidden">Sidebar view</legend>
      {options.map(({ view, label }) => (
        <label key={view} className="rpv-sidebar-view">
          <input
            className="rpv-visually-hidden"
            type="radio"
            name={groupName}
            value={view}
            checked={sidebar.view === view}
            onChange={() => sidebar.setView(view)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
