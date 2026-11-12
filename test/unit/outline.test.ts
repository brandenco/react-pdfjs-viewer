import { describe, expect, test } from "vitest";

import { readDocumentData } from "../../src/core/document-data.ts";
import { loadOutline, loadOutlinePages, outlineEntryAt } from "../../src/core/outline.ts";
import { makePdf } from "../fixtures/make-pdf.ts";
import { useTestDocument } from "./pdf-document.ts";

describe("loadOutline", () => {
  const withOutline = useTestDocument(() =>
    makePdf({ pageCount: 40, milestoneEvery: 10, extras: true }),
  );
  const withoutOutline = useTestDocument(() => makePdf({ pageCount: 3 }));

  test("reads the nested outline", async () => {
    const outline = await loadOutline(withOutline.current);
    expect(outline.map((item) => item.title)).toEqual(["Introduction", "Milestones"]);
    const milestones = outline[1]!;
    expect(milestones.items.map((item) => item.title)).toEqual([
      "Milestone 1",
      "Milestone 2",
      "Milestone 3",
      "Milestone 4",
    ]);
    expect(Array.isArray(milestones.items[0]!.dest)).toBe(true);
    expect(milestones.count).toBeGreaterThan(0); // expanded by default
    expect(outline[0]!.items.map((item) => item.title)).toEqual(["Links"]);
    expect(outline[0]!.count).toBeLessThan(0); // collapsed by default
  });

  test("finds the entry for the page being read", async () => {
    const entries = await loadOutlinePages(withOutline.current);
    // "Milestones" has no destination, so it has no page.
    expect(entries.map(({ item, pageIndex }) => [item.title, pageIndex])).toEqual([
      ["Introduction", 0],
      ["Links", 1],
      ["Milestone 1", 9],
      ["Milestone 2", 19],
      ["Milestone 3", 29],
      ["Milestone 4", 39],
    ]);

    const titleAt = (pageIndex: number): string | undefined =>
      outlineEntryAt(entries, pageIndex)?.item.title;
    expect(titleAt(0)).toBe("Introduction");
    expect(titleAt(5)).toBe("Links"); // the last entry starting on or before the page
    expect(titleAt(25)).toBe("Milestone 2");
    expect(outlineEntryAt(entries, 25)?.ancestors.map((item) => item.title)).toEqual([
      "Milestones",
    ]);
    expect(outlineEntryAt([], 3)).toBeNull();
  });

  test("is empty for documents without an outline", async () => {
    await expect(loadOutline(withoutOutline.current)).resolves.toEqual([]);
  });
});

describe("readDocumentData", () => {
  const doc = useTestDocument(() => makePdf({ pageCount: 1 }));

  test("loads once per document and loader", async () => {
    let calls = 0;
    const load = (): Promise<number> => Promise.resolve(++calls);
    const [first, second] = await Promise.all([
      readDocumentData(doc.current, load),
      readDocumentData(doc.current, load),
    ]);
    expect([first, second, calls]).toEqual([1, 1, 1]);
  });

  test("doesn't cache failures", async () => {
    let calls = 0;
    const load = (): Promise<number> =>
      ++calls === 1 ? Promise.reject(new Error("flaky")) : Promise.resolve(calls);
    await expect(readDocumentData(doc.current, load)).rejects.toThrow("flaky");
    await expect(readDocumentData(doc.current, load)).resolves.toBe(2);
  });
});
