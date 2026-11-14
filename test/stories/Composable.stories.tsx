import {
  PdfPages,
  PdfThumbnails,
  PdfViewerProvider,
  useRotation,
  useSearch,
  type PdfSource,
} from "@brandenco/react-pdfjs-viewer/headless";
import {
  PdfSearchBar,
  PdfSidebar,
  PdfToolbar,
  PdfViewer,
  PdfViewerBody,
  PdfViewerShell,
  ZoomControls,
} from "@brandenco/react-pdfjs-viewer/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";
import { expect, waitFor } from "storybook/test";

import {
  documentArgType,
  loadDocument,
  loadedDocument,
  workerSrc,
  type DocumentArgs,
} from "../fixtures/documents.ts";
import { waitForDocument, waitForRenderedPage } from "./helpers.ts";

/**
 * The default viewer's pieces, assembled by hand from the `/headless` and `/ui` entry
 * points. No wiring props: the pieces share state through the provider, and the shell
 * links them up for assistive tech.
 */
function ComposedViewer({ src }: { src: PdfSource }): ReactNode {
  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc}>
      <PdfViewerShell>
        <PdfToolbar />
        <PdfViewerBody>
          <PdfSidebar width={140}>
            <PdfThumbnails width={96} />
          </PdfSidebar>
          <PdfPages />
          <PdfSearchBar />
        </PdfViewerBody>
      </PdfViewerShell>
    </PdfViewerProvider>
  );
}

const meta = {
  title: "Composable",
  args: { document: "40 pages" },
  argTypes: { document: documentArgType },
  loaders: [loadDocument],
  render: (_args, { loaded }) => <ComposedViewer src={loadedDocument(loaded)} />,
} satisfies Meta<DocumentArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Toolbar, sidebar and search bar work together with no props. */
export const AssembledFromParts: Story = {
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);

    const thumbnailsToggle = canvas.getByRole("button", { name: "Sidebar" });
    const sidebar = document.getElementById(thumbnailsToggle.getAttribute("aria-controls") ?? "");
    await expect(sidebar).toHaveClass("rpv-sidebar");
    await userEvent.click(thumbnailsToggle);
    await expect(sidebar).toHaveAttribute("data-open");
    await waitFor(() => expect(canvasElement.querySelector(".rpv-thumbnail")).not.toBeNull());

    const searchButton = canvas.getByRole("button", { name: "Search" });
    await userEvent.click(searchButton);
    const input = canvas.getByRole("searchbox", { name: "Find in document" });
    await expect(input).toHaveFocus();
    await expect(searchButton).toHaveAttribute("aria-controls", input.closest("search")?.id);

    await userEvent.type(input, "Milestone");
    await waitFor(() => expect(input).toHaveAccessibleDescription("Result 1 of 4"), {
      timeout: 5000,
    });

    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument();
    await expect(searchButton).toHaveFocus();

    // The shell's Cmd/Ctrl+F shortcut opens the same bar.
    canvas.getByRole("region", { name: "Document" }).focus();
    await userEvent.keyboard("{Control>}f{/Control}");
    await expect(canvas.getByRole("searchbox")).toHaveFocus();
  },
};

function FindButton(): ReactNode {
  const { isOpen, toggleOpen } = useSearch();
  return (
    <button type="button" aria-expanded={isOpen} onClick={toggleOpen}>
      Find
    </button>
  );
}

/** A replacement toolbar passed to `<PdfViewer>` can still open its built-in search bar. */
export const CustomToolbarOpensSearch: Story = {
  render: (_args, { loaded }) => (
    <PdfViewer src={loadedDocument(loaded)} workerSrc={workerSrc} toolbar={<FindButton />} />
  ),
  async play({ canvas, userEvent }) {
    await waitFor(() => expect(canvas.getByRole("region", { name: "Document" })).toBeVisible());
    const find = canvas.getByRole("button", { name: "Find" });
    await userEvent.click(find);
    await expect(find).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("searchbox", { name: "Find in document" })).toHaveFocus();

    await userEvent.click(canvas.getByRole("button", { name: "Close search" }));
    await expect(find).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument();
  },
};

/**
 * `className` and `style` go on each component's root and add to ours, so helpers
 * that return both (StyleX's `stylex.props()`, for one) can be spread straight in.
 */
export const StyleProps: Story = {
  render: (_args, { loaded }) => {
    // What `stylex.props(styles.toolbar)` returns: atomic classes plus inline variables.
    const style: CSSProperties & Record<`--${string}`, string> = { "--x-gap": "12px" };
    const fromStylex = { className: "x1abc x2def", style };
    return (
      <PdfViewerProvider src={loadedDocument(loaded)} workerSrc={workerSrc}>
        <style>{`.app-toolbar { border-block-end-color: rgb(255, 0, 0); }`}</style>
        <PdfViewerShell>
          <PdfToolbar className="app-toolbar" />
          <ZoomControls {...fromStylex} />
          <PdfViewerBody>
            <PdfPages />
          </PdfViewerBody>
        </PdfViewerShell>
      </PdfViewerProvider>
    );
  },
  async play({ canvasElement }) {
    const toolbar = canvasElement.querySelector(".rpv-toolbar");
    await expect(toolbar).toHaveClass("rpv-toolbar app-toolbar");
    // A plain, single-class rule of the app's beats the library's styling.
    await expect(toolbar && getComputedStyle(toolbar).borderBottomColor).toBe("rgb(255, 0, 0)");

    const zoom = canvasElement.querySelector<HTMLElement>(".rpv-zoom-controls.x1abc.x2def");
    await expect(zoom?.style.getPropertyValue("--x-gap")).toBe("12px");
  },
};

function pixelsPerCssPx(canvas: HTMLCanvasElement): number {
  return canvas.width / canvas.getBoundingClientRect().width;
}

/**
 * Zoomed in past `maxCanvasPixels`, the page canvas has fewer pixels than the screen; the
 * visible part is drawn again on a detail canvas at full resolution.
 */
export const SharpAtHighZoom: Story = {
  render: (_args, { loaded }) => (
    <PdfViewerProvider src={loadedDocument(loaded)} workerSrc={workerSrc} initialScale={2}>
      {/* At 200%, a page is about 1632 × 2112 px: over the cap, while the visible part
          (at most 800 × 500) is under it. */}
      <PdfPages style={{ width: 800, height: 500 }} maxCanvasPixels={1000 * 1000} />
    </PdfViewerProvider>
  ),
  async play({ canvasElement }) {
    await waitForRenderedPage(canvasElement);
    const firstPage = canvasElement.querySelector<HTMLElement>('.rpv-page[data-page-number="1"]')!;
    const base = firstPage.querySelector<HTMLCanvasElement>(".rpv-page-canvas canvas")!;
    const detail = await waitFor(
      () => {
        const canvas = firstPage.querySelector<HTMLCanvasElement>(".rpv-page-detail canvas");
        if (!canvas) throw new Error("No detail canvas yet");
        return canvas;
      },
      { timeout: 5000 },
    );

    // The page canvas is capped well below the screen's density; the detail canvas isn't.
    await expect(pixelsPerCssPx(base)).toBeLessThan(0.6 * globalThis.devicePixelRatio);
    await expect(pixelsPerCssPx(detail)).toBeCloseTo(globalThis.devicePixelRatio, 1);
    // It covers the visible part of the page, not the whole page.
    const pageRect = firstPage.getBoundingClientRect();
    await expect(detail.getBoundingClientRect().height).toBeLessThan(pageRect.height);
  },
};

function RotateButton(): ReactNode {
  const { rotateClockwise } = useRotation();
  return (
    <button type="button" onClick={rotateClockwise}>
      Rotate
    </button>
  );
}

/**
 * Until a rotated page is re-rendered, its old canvas, text and links are turned to
 * match, instead of being squeezed upright into the rotated page box.
 */
export const RotationTransition: Story = {
  render: (_args, { loaded }) => (
    <PdfViewerProvider src={loadedDocument(loaded)} workerSrc={workerSrc} initialScale={1}>
      <RotateButton />
      {/* A long delay, so the in-between state can be checked. */}
      <PdfPages style={{ height: 500 }} renderDelay={500} />
    </PdfViewerProvider>
  ),
  async play({ canvas, canvasElement, userEvent }) {
    await waitForRenderedPage(canvasElement);
    const page = canvasElement.querySelector<HTMLElement>('.rpv-page[data-page-number="1"]')!;
    const canvasLayer = page.querySelector<HTMLElement>(".rpv-page-canvas")!;
    const textLayer = page.querySelector<HTMLElement>(".rpv-page-text")!;
    const oldCanvas = page.querySelector("canvas");

    await userEvent.click(canvas.getByRole("button", { name: "Rotate" }));
    // The page box is landscape now; the old (portrait) rendering is turned into it.
    const box = page.getBoundingClientRect();
    await expect(box.width).toBeGreaterThan(box.height);
    await expect(canvasLayer.style.transform).toBe("rotate(90deg)");
    await expect(textLayer.style.transform).toBe("rotate(90deg)");
    const turned = canvasLayer.getBoundingClientRect(); // after the transform
    await expect(turned.width).toBeCloseTo(box.width, 0);
    await expect(turned.height).toBeCloseTo(box.height, 0);
    await expect(page.querySelector("canvas")).toBe(oldCanvas);

    // Re-rendered at the new rotation: new canvas, no transform.
    await waitFor(() => expect(page.querySelector("canvas")).not.toBe(oldCanvas), {
      timeout: 5000,
    });
    await expect(canvasLayer.style.transform).toBe("");
    await expect(textLayer.style.transform).toBe("");
  },
};
