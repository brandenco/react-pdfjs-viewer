import { describe, expect, test } from "vitest";

import {
  buildSearchRegExp,
  normalizePageText,
  pickFirstActiveMatch,
  scanPages,
} from "../../src/core/search.ts";
import type { PageText } from "../../src/core/text.ts";
import type { SearchMatch } from "../../src/core/types.ts";

const defaults = { caseSensitive: false, wholeWord: false, matchDiacritics: false };

/** What `query` matches in `text`, as the original text each match highlights. */
function matchesIn(text: string, query: string, options = defaults): string[] {
  const regex = buildSearchRegExp(query, options);
  if (!regex) return [];
  const normalized = normalizePageText(
    { text, itemStarts: [0], itemStrings: [text] },
    !options.matchDiacritics,
  );
  return [...normalized.text.matchAll(regex)].map((match) => {
    const { start, end } = normalized.toOriginal(match.index, match.index + match[0].length);
    return text.slice(start, end);
  });
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

  test("matches ligatures and full-width letters by their plain form", () => {
    expect(matchesIn("the ﬁle is ﬂat", "file")).toEqual(["ﬁle"]);
    expect(matchesIn("the ﬁle is ﬂat", "flat")).toEqual(["ﬂat"]);
    expect(matchesIn("ＰＤＦ viewer", "pdf")).toEqual(["ＰＤＦ"]);
    // A query typed with a ligature finds the plain spelling too.
    expect(matchesIn("profile", "proﬁle")).toEqual(["profile"]);
  });

  test("ignores accents unless matchDiacritics is set", () => {
    expect(matchesIn("café, cafe, CAFÉ", "cafe")).toEqual(["café", "cafe", "CAFÉ"]);
    expect(matchesIn("café, cafe", "café")).toEqual(["café", "cafe"]);
    const exact = { ...defaults, matchDiacritics: true };
    expect(matchesIn("café, cafe", "café", exact)).toEqual(["café"]);
    expect(matchesIn("café, cafe", "cafe", exact)).toEqual(["cafe"]);
  });

  test("treats a letter plus a combining accent like the precomposed letter", () => {
    const decomposed = "cafe\u0301"; // "café" as e + combining acute
    expect(matchesIn(decomposed, "café", { ...defaults, matchDiacritics: true })).toEqual([
      decomposed,
    ]);
    expect(matchesIn(decomposed, "cafe")).toEqual([decomposed]);
  });

  test("joins words hyphenated at the end of a line, but not real hyphens", () => {
    expect(matchesIn("an exam-\nple here", "example")).toEqual(["exam-\nple"]);
    expect(matchesIn("an exam\u2010\nple", "example")).toEqual(["exam\u2010\nple"]);
    // A hyphen mid-line, or before a number, is a real one.
    expect(matchesIn("well-known", "wellknown")).toEqual([]);
    expect(matchesIn("pages 10-\n20", "1020")).toEqual([]);
  });

  test("ignores soft hyphens", () => {
    expect(matchesIn("hyphen\u00ADation", "hyphenation")).toEqual(["hyphen\u00ADation"]);
  });

  test("keeps marks that are part of a letter in other scripts", () => {
    // Devanagari vowel signs are combining marks too, but change the syllable.
    expect(matchesIn("किताब", "कताब")).toEqual([]);
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
      defaults,
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
      defaults,
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
    for await (const progress of scanPages(
      pages.length,
      getPageText,
      regex,
      defaults,
      controller.signal,
    )) {
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
