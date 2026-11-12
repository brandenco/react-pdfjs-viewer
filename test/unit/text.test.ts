import { describe, expect, test } from "vitest";

import { splitIntoItemSegments, type PageText } from "../../src/core/text.ts";

// Three text items as pdf.js would report them: "Hello " "wor" "ld", joined into one string.
const pageText: PageText = {
  text: "Hello world",
  itemStarts: [0, 6, 9],
  itemStrings: ["Hello ", "wor", "ld"],
};

describe("splitIntoItemSegments", () => {
  test("keeps a match that lies inside one item as one segment", () => {
    expect(splitIntoItemSegments(pageText, [{ start: 0, end: 5, isActive: false }])).toEqual([
      { item: 0, start: 0, end: 5, isActive: false },
    ]);
  });

  test("splits a match that spans several items, with offsets local to each item", () => {
    expect(splitIntoItemSegments(pageText, [{ start: 6, end: 11, isActive: true }])).toEqual([
      { item: 1, start: 0, end: 3, isActive: true },
      { item: 2, start: 0, end: 2, isActive: true },
    ]);
  });

  test("handles several matches", () => {
    const segments = splitIntoItemSegments(pageText, [
      { start: 1, end: 3, isActive: false },
      { start: 9, end: 10, isActive: false },
    ]);
    expect(segments.map((segment) => segment.item)).toEqual([0, 2]);
  });
});
