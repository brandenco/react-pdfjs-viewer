"use client";

import type { CSSProperties, ReactNode } from "react";

import type { OutlineItem } from "../core/outline.ts";
import { useOutline, useOutlineEntry, type Outline } from "../headless/use-outline.ts";
import { ChevronRightIcon } from "./icons.tsx";

export interface PdfOutlineProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** Shown when the document has no outline. Default: a short message. */
  emptyFallback?: ReactNode | undefined;
  /** Where entries that link outside the document open, as an `<a target>`. Default `"_blank"`. */
  externalLinkTarget?: string | undefined;
}

/**
 * The document outline (bookmarks) as a collapsible list. Activating an entry scrolls
 * to it, and the entry for the page being read is marked. Entries start expanded or
 * collapsed as the document specifies.
 *
 * Built as nested lists of buttons with disclosure toggles rather than an ARIA tree:
 * every control stays in the normal Tab order and works with any assistive tech.
 */
export function PdfOutline(props: PdfOutlineProps): ReactNode {
  const { className, style, emptyFallback, externalLinkTarget = "_blank" } = props;
  const outline = useOutline();
  const context: EntryContext = { outline, externalLinkTarget };

  return (
    <nav
      className={className ? `rpv-outline ${className}` : "rpv-outline"}
      style={style}
      aria-label="Outline"
      aria-busy={outline.status === "loading"}
    >
      {outline.status === "ready" && outline.items.length === 0 && (
        <p className="rpv-outline-empty">{emptyFallback ?? "This document has no outline."}</p>
      )}
      {outline.items.length > 0 && <OutlineList items={outline.items} context={context} />}
    </nav>
  );
}

interface EntryContext {
  outline: Outline;
  externalLinkTarget: string;
}

function OutlineList(props: { items: readonly OutlineItem[]; context: EntryContext }): ReactNode {
  const { items, context } = props;
  // Leaves only make room for a chevron when a sibling has one, so they line up.
  const hasToggles = items.some((item) => item.items.length > 0);
  return (
    // Explicit role: Safari drops list semantics from lists with `list-style: none`.
    // oxlint-disable-next-line jsx-a11y/no-redundant-roles
    <ul role="list" className="rpv-outline-list" data-toggles={hasToggles ? "" : undefined}>
      {items.map((item, index) => (
        // Outline entries have no ids, and titles needn't be unique.
        // oxlint-disable-next-line react/no-array-index-key
        <OutlineEntry key={index} item={item} context={context} />
      ))}
    </ul>
  );
}

function OutlineEntry(props: { item: OutlineItem; context: EntryContext }): ReactNode {
  const { item, context } = props;
  const entry = useOutlineEntry(context.outline, item);
  const { hasChildren, isExpanded, toggle, isCurrent, containsCurrent } = entry;
  const titleStyle: CSSProperties = {
    fontWeight: item.bold ? 600 : undefined,
    fontStyle: item.italic ? "italic" : undefined,
  };
  const chevron = (
    <span className="rpv-outline-chevron" aria-hidden="true">
      <ChevronRightIcon />
    </span>
  );

  let row: ReactNode;
  if (item.url) {
    row = (
      <a
        className="rpv-outline-title"
        style={titleStyle}
        href={item.url}
        target={item.newWindow ? "_blank" : context.externalLinkTarget}
        rel="noopener noreferrer nofollow"
      >
        {item.title}
      </a>
    );
  } else if (item.dest === null) {
    // Nowhere to go: a parent entry just expands and collapses; a leaf is plain text.
    row = hasChildren ? (
      <button
        type="button"
        className="rpv-outline-title"
        data-with-chevron=""
        style={titleStyle}
        aria-expanded={isExpanded}
        onClick={toggle}
      >
        {chevron}
        {item.title}
      </button>
    ) : (
      <span className="rpv-outline-title" style={titleStyle}>
        {item.title}
      </span>
    );
  } else {
    row = (
      <button
        type="button"
        className="rpv-outline-title"
        style={titleStyle}
        aria-current={isCurrent ? "location" : undefined}
        onClick={entry.select}
      >
        {item.title}
      </button>
    );
  }

  const ownsChevron = hasChildren && item.dest === null && !item.url;
  return (
    <li className="rpv-outline-entry">
      <div
        className="rpv-outline-row"
        data-current={isCurrent ? "" : undefined}
        data-contains-current={containsCurrent ? "" : undefined}
      >
        {hasChildren && !ownsChevron && (
          <button
            type="button"
            className="rpv-outline-toggle"
            aria-label={`Subsections of ${item.title}`}
            aria-expanded={isExpanded}
            onClick={toggle}
          >
            {chevron}
          </button>
        )}
        {row}
      </div>
      {hasChildren && isExpanded && <OutlineList items={item.items} context={context} />}
    </li>
  );
}
