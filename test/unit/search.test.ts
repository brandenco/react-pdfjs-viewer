import { describe, expect, test } from "vitest";

import { buildSearchRegExp, pickFirstActiveMatch, scanPages } from "../../src/core/search.ts";
import type { PageText } from "../../src/core/text.ts";
import type { SearchMatch } from "../../src/core/types.ts";

const defaults = { caseSensitive: false, wholeWord: false };

function matchesIn(text: string, query: string, options = defaults): string[] {
  const regex = buildSearchRegExp(query, options);
  return regex ? [...text.matchAll(regex)].map((match) => match[0]) : [];
}

describe("buildSearchRegExp", () => {
  test("returns null for an empty or blank query", () => {
    expect(buildSearchRegExp("", defaults)).toBeNull();
    expect(buildSearchRegExp("   ", defaults)).toBeNull();
  });

  test("ignores case unless asked not to", () => {
    expect(matchesIn("PDF pdf Pdf", "pdf")).toEqual(["PDF", "pdf", "Pdf"]);
    expect(matchesIn("PDF pdf Pdf", "pdf", { ...defaults, caseSensitive: true })).toEqual(["pdf"]);
  });

  test("matches regex characters literally", () => {
    expect(matchesIn("cost (USD) is $5.00", "(USD)")).toEqual(["(USD)"]);
    expect(matchesIn("a.b axb", "a.b")).toEqual(["a.b"]);
  });

  test("lets a space in the query match any run of whitespace, like a line break", () => {
    expect(matchesIn("virtual\n  scroll", "virtual scroll")).toEqual(["virtual\n  scroll"]);
  });

  test("whole-word mode skips matches inside longer words", () => {
    const wholeWord = { ...defaults, wholeWord: true };
    expect(matchesIn("view viewer preview view", "view", wholeWord)).toEqual(["view", "view"]);
    expect(matchesIn("café cafés", "café", wholeWord)).toEqual(["café"]);
  });
});

const pages = ["alpha beta", "beta", "gamma", "beta beta"];

function getPageText(pageIndex: number): Promise<PageText> {
  const text = pages[pageIndex]!;
  return Promise.resolve({ text, itemStarts: [0], itemStrings: [text] });
}

function getPageTextFailingOnPage1(pageIndex: number): Promise<PageText> {
  return pageIndex === 1 ? Promise.reject(new Error("broken page")) : getPageText(pageIndex);
}

describe("scanPages", () => {
  test("finds every match, in page order, and reports completion", async () => {
    const regex = buildSearchRegExp("beta", defaults)!;
    const reports = [];
    for await (const progress of scanPages(
      pages.length,
      getPageText,
      regex,
      new AbortController().signal,
    )) {
      reports.push(progress);
    }

    const matches = reports.flatMap((report) => report.newMatches);
    expect(matches).toEqual([
      { pageIndex: 0, start: 6, end: 10 },
      { pageIndex: 1, start: 0, end: 4 },
      { pageIndex: 3, start: 0, end: 4 },
      { pageIndex: 3, start: 5, end: 9 },
    ]);
    expect(reports.at(-1)).toMatchObject({ pagesSearched: 4, isComplete: true });
  });

  test("skips pages whose text can't be read", async () => {
    const regex = buildSearchRegExp("beta", defaults)!;
    const matches: SearchMatch[] = [];
    for await (const progress of scanPages(
      pages.length,
      getPageTextFailingOnPage1,
      regex,
      new AbortController().signal,
    )) {
      matches.push(...progress.newMatches);
    }
    expect(matches.map((match) => match.pageIndex)).toEqual([0, 3, 3]);
  });

  test("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const regex = buildSearchRegExp("beta", defaults)!;
    const reports = [];
    for await (const progress of scanPages(pages.length, getPageText, regex, controller.signal)) {
      reports.push(progress);
    }
    expect(reports).toEqual([]);
  });
});

describe("pickFirstActiveMatch", () => {
  const matches: SearchMatch[] = [
    { pageIndex: 2, start: 0, end: 1 },
    { pageIndex: 5, start: 0, end: 1 },
  ];

  test("picks the first match on or after the current page", () => {
    expect(pickFirstActiveMatch(matches, 0, false)).toBe(0);
    expect(pickFirstActiveMatch(matches, 3, false)).toBe(1);
  });

  test("waits for the scan to finish before wrapping to the first match", () => {
    expect(pickFirstActiveMatch(matches, 9, false)).toBe(-1);
    expect(pickFirstActiveMatch(matches, 9, true)).toBe(0);
    expect(pickFirstActiveMatch([], 0, true)).toBe(-1);
  });
});
