import { describe, expect, test } from "vitest";

import { PDF_TO_CSS_UNITS } from "../../src/core/pdfjs.ts";
import { clamp, fitScale, nextZoomStep, previousZoomStep } from "../../src/core/zoom.ts";

describe("zoom steps", () => {
  test("step to the next level above or below the current scale", () => {
    expect(nextZoomStep(1)).toBe(1.1);
    expect(previousZoomStep(1)).toBe(0.9);
    expect(nextZoomStep(1.18)).toBe(1.25); // from an in-between scale
  });

  test("treat a scale within rounding error of a step as that step", () => {
    expect(nextZoomStep(0.9999)).toBe(1.1);
  });

  test("return undefined past the ends", () => {
    expect(nextZoomStep(5)).toBeUndefined();
    expect(previousZoomStep(0.25)).toBeUndefined();
  });
});

describe("fitScale", () => {
  // A US Letter page (612 × 792 pt) is 816 × 1056 CSS px at 100%.
  const letter = { width: 612, height: 792 };

  test("page-width fills the width minus padding", () => {
    const scale = fitScale("page-width", letter, { width: 836, height: 500 }, 10);
    expect(scale).toBe(1);
  });

  test("page-fit also fits the height", () => {
    const scale = fitScale("page-fit", letter, { width: 2000, height: 548 }, 10);
    expect(scale).toBeCloseTo(528 / (792 * PDF_TO_CSS_UNITS), 3);
  });

  test("rounds down to 3 decimals so tiny resizes don't change the scale", () => {
    const a = fitScale("page-width", letter, { width: 900.2, height: 500 }, 10);
    const b = fitScale("page-width", letter, { width: 900.4, height: 500 }, 10);
    expect(a).toBe(b);
  });
});

test("clamp", () => {
  expect(clamp(5, 0, 3)).toBe(3);
  expect(clamp(-1, 0, 3)).toBe(0);
  expect(clamp(2, 0, 3)).toBe(2);
});
