import { describe, expect, test } from "vitest";

import {
  computeListLayout,
  indexesIn,
  itemIndexAt,
  itemsBetween,
  NOTHING_VISIBLE,
} from "../../src/core/layout.ts";

// Three items of height 100, 200, 100 with a 10px gap: tops at 10, 120, 330.
const heights = [100, 200, 100];
const layout = computeListLayout(heights.length, (index) => heights[index]!, 10);

describe("computeListLayout", () => {
  test("places items one after another with a gap before, between and after", () => {
    expect([...layout.tops]).toEqual([10, 120, 330]);
    expect([...layout.heights]).toEqual([100, 200, 100]);
    expect(layout.totalHeight).toBe(440);
  });

  test("an empty list has no height", () => {
    expect(computeListLayout(0, () => 100, 10).totalHeight).toBe(0);
  });
});

describe("itemIndexAt", () => {
  test("finds the item at a position", () => {
    expect(itemIndexAt(layout, 50)).toBe(0);
    expect(itemIndexAt(layout, 120)).toBe(1);
    expect(itemIndexAt(layout, 400)).toBe(2);
  });

  test("a position in a gap belongs to the item above it", () => {
    expect(itemIndexAt(layout, 115)).toBe(0);
  });

  test("clamps positions outside the list", () => {
    expect(itemIndexAt(layout, -100)).toBe(0);
    expect(itemIndexAt(layout, 10_000)).toBe(2);
  });
});

describe("itemsBetween", () => {
  test("returns every item overlapping the band", () => {
    expect(itemsBetween(layout, 50, 200)).toEqual({ first: 0, last: 1 });
    expect(indexesIn(itemsBetween(layout, 0, 1000))).toEqual([0, 1, 2]);
  });

  test("returns nothing for an empty list", () => {
    const empty = computeListLayout(0, () => 100, 10);
    expect(itemsBetween(empty, 0, 100)).toBe(NOTHING_VISIBLE);
    expect(indexesIn(NOTHING_VISIBLE)).toEqual([]);
  });
});
