import type { PDFDocumentProxy, PageViewport } from "pdfjs-dist";
import { describe, expect, test } from "vitest";

import {
  createPageTransform,
  pageSizeOf,
  readPageGeometry,
  type PageGeometry,
} from "../../src/core/page-geometry.ts";
import type { Rotation } from "../../src/core/types.ts";
import { makePdf } from "../fixtures/make-pdf.ts";
import { useTestDocument } from "./pdf-document.ts";

type ViewportConstructor = new (options: {
  viewBox: readonly number[];
  userUnit: number;
  scale: number;
  rotation: number;
}) => PageViewport;

/** pdf.js' PageViewport class, which it doesn't export: taken from a real viewport. */
async function viewportClass(doc: PDFDocumentProxy): Promise<ViewportConstructor> {
  const page = await doc.getPage(1);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- it is PageViewport
  return page.getViewport({ scale: 1 }).constructor as ViewportConstructor;
}

// A view box that doesn't start at the origin, as cropped pages' don't.
const offsetView: PageGeometry["view"] = [30, -40, 530, 760];
const rotations: Rotation[] = [0, 90, 180, 270];

describe("createPageTransform", () => {
  const doc = useTestDocument(() => makePdf({ pageCount: 1 }));

  test.each(rotations)("matches pdf.js' PageViewport, page rotated %i°", async (pageRotate) => {
    const Viewport = await viewportClass(doc.current);
    for (const viewerRotation of rotations) {
      const geometry: PageGeometry = { view: offsetView, rotate: pageRotate };
      const scale = 1.75;
      const transform = createPageTransform(geometry, scale, viewerRotation);
      const viewport = new Viewport({
        viewBox: offsetView,
        userUnit: 1,
        scale,
        rotation: (pageRotate + viewerRotation) % 360,
      });

      for (const [x, y] of [
        [30, -40],
        [530, 760],
        [100, 200],
      ] as const) {
        const [vx, vy] = viewport.convertToViewportPoint(x, y);
        const [ox, oy] = transform.toViewportPoint(x, y);
        expect(ox).toBeCloseTo(vx);
        expect(oy).toBeCloseTo(vy);

        const [px, py] = transform.toPdfPoint(vx, vy);
        expect(px).toBeCloseTo(x);
        expect(py).toBeCloseTo(y);
      }

      // The whole view box fills the on-screen box.
      const box = transform.toViewportRect(offsetView);
      expect(box.left).toBeCloseTo(0);
      expect(box.top).toBeCloseTo(0);
      expect(box.width).toBeCloseTo(viewport.width);
      expect(box.height).toBeCloseTo(viewport.height);
    }
  });

  test("rects round-trip through screen space", () => {
    const transform = createPageTransform({ view: offsetView, rotate: 90 }, 2, 180);
    const rect = transform.toViewportRect([100, 200, 150, 260]);
    const back = transform.toPdfRect(rect);
    [100, 200, 150, 260].forEach((value, index) => expect(back[index]).toBeCloseTo(value));
  });
});

describe("readPageGeometry", () => {
  const doc = useTestDocument(() => makePdf({ pageCount: 1 }));

  test("reads the view box and rotation; the size matches pdf.js", async () => {
    const page = await doc.current.getPage(1);
    const geometry = readPageGeometry(page);
    expect(geometry).toEqual({ view: [0, 0, 612, 792], rotate: 0 });
    const { width, height } = page.getViewport({ scale: 1 });
    expect(pageSizeOf(geometry)).toEqual({ width, height });
    expect(pageSizeOf({ view: offsetView, rotate: 90 })).toEqual({ width: 800, height: 500 });
  });
});
