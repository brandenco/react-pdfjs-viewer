"use client";

import { useMemo, useState } from "react";

import {
  loadOutline,
  loadOutlinePages,
  outlineEntryAt,
  type OutlineItem,
} from "../core/outline.ts";
import { usePdfViewerState, usePdfViewerStore } from "./context.tsx";
import { useDocumentData, type DocumentDataStatus } from "./use-document-data.ts";

export interface Outline {
  status: DocumentDataStatus;
  /** The document's bookmarks, nested. Empty while loading and for documents without. */
  items: readonly OutlineItem[];
  /**
   * Scrolls to an entry's destination. Entries with a `url` instead point outside the
   * document: render those as links. Resolves to `false` if there was nowhere to go.
   */
  goToItem: (item: OutlineItem) => Promise<boolean>;
  /** The entry for the page being read, once the entries' pages are known. */
  currentItem: OutlineItem | null;
  /** `currentItem`'s parents, outermost first, to mark a collapsed one that contains it. */
  currentPath: readonly OutlineItem[];
}

const NO_ITEMS: readonly OutlineItem[] = [];

/** The document outline (bookmarks / table of contents). Loaded on first use. */
export function useOutline(): Outline {
  const store = usePdfViewerStore();
  const { status, data } = useDocumentData(loadOutline);
  const goToItem = useMemo(
    () => (item: OutlineItem) =>
      item.dest === null ? Promise.resolve(false) : store.goToDestination(item.dest),
    [store],
  );
  const currentPage = usePdfViewerState((state) => state.currentPage);
  const pages = useDocumentData(loadOutlinePages);
  const current = useMemo(
    () => (pages.data ? outlineEntryAt(pages.data, currentPage - 1) : null),
    [pages.data, currentPage],
  );

  return {
    status,
    items: data ?? NO_ITEMS,
    goToItem,
    currentItem: current?.item ?? null,
    currentPath: current?.ancestors ?? NO_ITEMS,
  };
}

export interface OutlineEntry {
  hasChildren: boolean;
  /** Starts as the document specifies for the entry. */
  isExpanded: boolean;
  setExpanded: (isExpanded: boolean) => void;
  toggle: () => void;
  /** The entry for the page being read. */
  isCurrent: boolean;
  /** Collapsed, with the current entry somewhere inside: mark it in its place. */
  containsCurrent: boolean;
  /** Whether it points somewhere in this document (`select` does something). */
  canNavigate: boolean;
  /** Scrolls to the entry's destination. */
  select: () => void;
}

/**
 * The state of one outline entry, for rendering your own outline tree. Pass the result
 * of one `useOutline()` call from the tree's root, so entries don't each subscribe.
 */
export function useOutlineEntry(outline: Outline, item: OutlineItem): OutlineEntry {
  const hasChildren = item.items.length > 0;
  // pdf.js reports a positive `count` for entries the document wants open.
  const [isExpanded, setExpanded] = useState((item.count ?? 0) > 0);
  return {
    hasChildren,
    isExpanded,
    setExpanded,
    toggle: () => setExpanded(!isExpanded),
    isCurrent: item === outline.currentItem,
    containsCurrent: hasChildren && !isExpanded && outline.currentPath.includes(item),
    canNavigate: item.dest !== null,
    select: () => {
      outline.goToItem(item).catch(reportError);
    },
  };
}
