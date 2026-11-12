import { describe, expect, test } from "vitest";

import { detailRegion, regionContains } from "../../src/headless/canvas.ts";
import { renderDelayFor } from "../../src/headless/use-detail-canvas.ts";

const page = { width: 4000, height: 5000 };

describe("detailRegion", () => {
  test("adds half the visible size on each side", () => {
    const visible = { x: 1000, y: 1000, width: 800, height: 600 };
    expect(detailRegion(visible, page, 1e9, 1)).toEqual({
      x: 600,
      y: 700,
      width: 1600,
      height: 1200,
    });
  });

  test("stays on the page", () => {
    const visible = { x: 0, y: 4600, width: 800, height: 400 };
    const region = detailRegion(visible, page, 1e9, 1);
    expect(region.x).toBe(0);
    expect(region.y + region.height).toBe(5000);
    expect(regionContains(region, visible)).toBe(true);
  });

  test("shrinks the margin to stay under the pixel cap", () => {
    const visible = { x: 1000, y: 1000, width: 1000, height: 1000 };
    const outputScale = 2;
    const maxPixels = 1500 * 1500 * outputScale * outputScale;
    const region = detailRegion(visible, page, maxPixels, outputScale);
    expect(region.width * region.height).toBeLessThanOrEqual(1500 * 1500 + 1e-6);
    expect(regionContains(region, visible)).toBe(true);
  });

  test("never cuts into the visible part, even over the cap", () => {
    const visible = { x: 0, y: 0, width: 3000, height: 2000 };
    expect(detailRegion(visible, page, 1000, 1)).toEqual(visible);
  });
});

describe("renderDelayFor", () => {
  test("waits longer right after a scale change", () => {
    const lastScale = { current: null };
    expect(renderDelayFor(lastScale, 1, 60, 400)).toBe(60); // first render
    expect(renderDelayFor(lastScale, 1, 60, 400)).toBe(60); // same scale (rotation, say)
    expect(renderDelayFor(lastScale, 1.2, 60, 400)).toBe(400); // zooming
    expect(renderDelayFor(lastScale, 1.2, 60, 400)).toBe(60);
  });
});
