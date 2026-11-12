import { describe, expect, test } from "vitest";

import type { PagePosition } from "../../src/core/navigation.ts";
import { PdfViewerStore, type PageScroller } from "../../src/core/store.ts";
import { makePdf } from "../fixtures/make-pdf.ts";

function recordingScroller(): PageScroller & { calls: [number, PagePosition | undefined][] } {
  const calls: [number, PagePosition | undefined][] = [];
  return {
    calls,
    scrollToPage: (pageIndex, position) => void calls.push([pageIndex, position]),
    scrollToRect: () => {},
    getViewportSize: () => ({ width: 800, height: 600 }),
    getPagePadding: () => 16,
  };
}

/** Loads `bytes` into `store` and waits until it's ready. */
async function load(store: PdfViewerStore, bytes: Uint8Array): Promise<() => void> {
  const ready = new Promise<void>((resolve, reject) => {
    const unsubscribe = store.subscribe(() => {
      const { status, error } = store.getState();
      if (status === "ready") resolve();
      if (status === "error") reject(error ?? new Error("load failed"));
      if (status === "ready" || status === "error") unsubscribe();
    });
  });
  const close = store.load(bytes);
  await ready;
  return close;
}

describe("PdfViewerStore", () => {
  test("rotation swaps page sizes and normalizes to quarter turns", async () => {
    const store = new PdfViewerStore();
    const close = await load(store, makePdf({ pageCount: 2 }));
    const [portrait] = store.getState().pageSizes;

    store.rotateClockwise();
    expect(store.getState().rotation).toBe(90);
    expect(store.getState().pageSizes[0]).toEqual({
      width: portrait!.height,
      height: portrait!.width,
    });

    store.setRotation(-90);
    expect(store.getState().rotation).toBe(270);
    store.setRotation(181);
    expect(store.getState().rotation).toBe(180);
    expect(store.getState().pageSizes[0]).toEqual(portrait);
    close();
  });

  test("navigation before a scroller attaches is applied when it does", async () => {
    const store = new PdfViewerStore({ initialPage: 3 });
    const close = await load(store, makePdf({ pageCount: 5 }));
    expect(store.getState().currentPage).toBe(3);

    store.goToPage(4);
    const scroller = recordingScroller();
    const detach = store.attachScroller(scroller);
    expect(scroller.calls).toEqual([[3, {}]]);

    store.goToPage(2);
    expect(scroller.calls.at(-1)).toEqual([1, {}]);
    detach();
    close();
  });

  test("goToDestination scrolls to a named destination", async () => {
    const store = new PdfViewerStore();
    const close = await load(store, makePdf({ pageCount: 6, milestoneEvery: 2, extras: true }));
    const scroller = recordingScroller();
    store.attachScroller(scroller);

    await expect(store.goToDestination("last-page")).resolves.toBe(true);
    expect(scroller.calls.at(-1)).toEqual([5, {}]);
    expect(store.getState().currentPage).toBe(6);
    await expect(store.goToDestination("nowhere")).resolves.toBe(false);
    close();
  });

  test("closing the search bar clears the search", async () => {
    const store = new PdfViewerStore();
    const close = await load(store, makePdf({ pageCount: 4, milestoneEvery: 2 }));
    store.setSearchOpen(true);
    await store.search("Milestone");
    expect(store.getState().search.matches).toHaveLength(2);

    store.setSearchOpen(false);
    expect(store.getState().isSearchOpen).toBe(false);
    expect(store.getState().search.query).toBe("");
    close();
  });
});
