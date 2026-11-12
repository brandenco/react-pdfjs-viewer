import { expect, waitFor } from "storybook/test";
import type { within } from "storybook/test";

type Canvas = ReturnType<typeof within>;

/** Waits until the viewer shows "of N" next to the page field, i.e. the document is ready. */
export async function waitForDocument(canvas: Canvas, pageCount: number): Promise<void> {
  await canvas.findByText(`of ${pageCount}`, undefined, { timeout: 20_000 });
}

/** Waits until at least one page has a rendered canvas and a text layer. */
export async function waitForRenderedPage(root: HTMLElement): Promise<void> {
  await waitFor(
    async () => {
      const canvas = root.querySelector<HTMLCanvasElement>(".rpv-page-canvas canvas");
      await expect(canvas?.width).toBeGreaterThan(0);
      await expect(root.querySelector(".rpv-text-layer span")).not.toBeNull();
    },
    { timeout: 10_000 },
  );
}

/** The text of the active search highlight (CSS Custom Highlight API), if any. */
export function activeHighlightText(): string | undefined {
  const highlight = CSS.highlights.get("rpv-search-active");
  const [range] = highlight ? [...highlight] : [];
  return range instanceof Range ? range.toString() : undefined;
}

/** Whether `target` is fully inside the visible part of `container`. */
export function isInView(
  target: { getBoundingClientRect(): DOMRect },
  container: Element,
): boolean {
  const rect = target.getBoundingClientRect();
  const view = container.getBoundingClientRect();
  return rect.top >= view.top && rect.bottom <= view.bottom;
}

export function mountedPageNumbers(root: HTMLElement): number[] {
  return [...root.querySelectorAll<HTMLElement>(".rpv-page")].map((page) =>
    Number(page.dataset["pageNumber"]),
  );
}
