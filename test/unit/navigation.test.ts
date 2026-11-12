import { describe, expect, test } from "vitest";

import { destinationPoint, resolveDestination } from "../../src/core/navigation.ts";
import { makePdf, MILESTONE_Y } from "../fixtures/make-pdf.ts";
import { useTestDocument } from "./pdf-document.ts";

describe("destinationPoint", () => {
  const ref = { num: 1, gen: 0 };

  test("XYZ gives both coordinates, null meaning 'keep'", () => {
    expect(destinationPoint([ref, { name: "XYZ" }, 72, 500, null])).toEqual({ x: 72, y: 500 });
    expect(destinationPoint([ref, { name: "XYZ" }, null, 500, 0])).toEqual({
      x: undefined,
      y: 500,
    });
  });

  test("FitH / FitV give one coordinate; FitR the rectangle's top-left", () => {
    expect(destinationPoint([ref, { name: "FitH" }, 300])).toEqual({ x: undefined, y: 300 });
    expect(destinationPoint([ref, { name: "FitBV" }, 40])).toEqual({ x: 40, y: undefined });
    expect(destinationPoint([ref, { name: "FitR" }, 10, 20, 110, 220])).toEqual({ x: 10, y: 220 });
  });

  test("Fit and unknown view types show the whole page", () => {
    expect(destinationPoint([ref, { name: "Fit" }])).toEqual({ x: undefined, y: undefined });
    expect(destinationPoint([ref, "garbage"])).toEqual({ x: undefined, y: undefined });
  });
});

describe("resolveDestination", () => {
  const opened = useTestDocument(() =>
    makePdf({ pageCount: 40, milestoneEvery: 10, extras: true }),
  );

  test("resolves an explicit destination to a page and a position on it", async () => {
    const page20 = await opened.current.getPage(20);
    const target = await resolveDestination(opened.current, [
      page20.ref,
      { name: "XYZ" },
      72,
      MILESTONE_Y,
    ]);
    expect(target?.pageIndex).toBe(19);
    // Page 20 is portrait Letter (612 × 792): y = 80 from the bottom is near the bottom.
    expect(target?.top).toBeCloseTo((792 - MILESTONE_Y) / 792);
    expect(target?.left).toBeCloseTo(72 / 612);
  });

  test("resolves named destinations", async () => {
    await expect(resolveDestination(opened.current, "last-page")).resolves.toEqual({
      pageIndex: 39,
    });
  });

  test("accounts for the viewer's rotation", async () => {
    const page1 = await opened.current.getPage(1);
    const target = await resolveDestination(opened.current, [page1.ref, { name: "FitH" }, 792], 90);
    // Rotated 90° clockwise, the page's top edge is on the right: a horizontal position.
    expect(target).toEqual({ pageIndex: 0, left: 1 });
  });

  test("returns null for destinations that aren't in the document", async () => {
    await expect(resolveDestination(opened.current, "nowhere")).resolves.toBeNull();
    await expect(
      resolveDestination(opened.current, [{ num: 9999, gen: 0 }, { name: "Fit" }]),
    ).resolves.toBe(null);
    await expect(resolveDestination(opened.current, [])).resolves.toBeNull();
  });
});
