import type { Meta, StoryObj } from "@storybook/react-vite";
import { PdfViewer, type PdfViewerProps } from "react-pdfjs-viewer";
import { expect, spyOn, waitFor } from "storybook/test";

import {
  documentArgType,
  loadDocument,
  loadedDocument,
  workerSrc,
  type DocumentArgs,
} from "../fixtures/documents.ts";
import {
  activeHighlightText,
  isInView,
  mountedPageNumbers,
  waitForDocument,
  waitForRenderedPage,
} from "./helpers.ts";

/** PdfViewer's props, except that the document is picked by name (see fixtures). */
type ViewerStoryArgs = Omit<PdfViewerProps, "src"> & DocumentArgs;

const meta = {
  title: "PdfViewer",
  args: { document: "40 pages", workerSrc },
  argTypes: { document: documentArgType, workerSrc: { control: false } },
  loaders: [loadDocument],
  render: ({ document: _name, ...props }, { loaded }) => (
    <PdfViewer {...props} src={loadedDocument(loaded)} />
  ),
} satisfies Meta<ViewerStoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 40 pages; only the ones near the viewport are mounted. */
export const Default: Story = {
  async play({ canvas, canvasElement }) {
    await waitForDocument(canvas, 40);
    await waitForRenderedPage(canvasElement);

    const mounted = mountedPageNumbers(canvasElement);
    await expect(mounted.length).toBeGreaterThan(0);
    await expect(mounted.length).toBeLessThan(40);

    // Pages are list items that announce their position in the whole document.
    const firstPage = canvasElement.querySelector(".rpv-page");
    await expect(firstPage).toHaveAttribute("aria-posinset", "1");
    await expect(firstPage).toHaveAttribute("aria-setsize", "40");
  },
};

/** 5,000 pages: jumping to a page mounts only that page and its neighbours. */
export const LargeDocument: Story = {
  args: { document: "5,000 pages" },
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 5000);
    await expect(mountedPageNumbers(canvasElement).length).toBeLessThanOrEqual(4);

    const pageField = canvas.getByRole("textbox", { name: "Page number" });
    await userEvent.clear(pageField);
    await userEvent.type(pageField, "2500{Enter}");

    // Jumping across 2,500 pages scrolls, then mounts and renders; allow for a busy machine.
    await waitFor(() => expect(mountedPageNumbers(canvasElement)).toContain(2500), {
      timeout: 5000,
    });
    await expect(mountedPageNumbers(canvasElement).length).toBeLessThanOrEqual(4);
    await expect(pageField).toHaveValue("2500");
  },
};

export const PageNavigation: Story = {
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    const pageField = canvas.getByRole("textbox", { name: "Page number" });
    const previous = canvas.getByRole("button", { name: "Previous page" });

    // On page 1, "Previous" is disabled but stays focusable (aria-disabled).
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(previous);
    await expect(pageField).toHaveValue("1");

    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(pageField).toHaveValue("2"));

    // The "of 40" next to the field is part of its description.
    await expect(pageField).toHaveAccessibleDescription("of 40");
  },
};

/** Milestones are on pages 10, 20, 30 and 40. */
export const Search: Story = {
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    const searchButton = canvas.getByRole("button", { name: "Search" });
    await userEvent.click(searchButton);

    const input = canvas.getByRole("searchbox", { name: "Find in document" });
    await expect(input).toHaveFocus();
    await expect(searchButton).toHaveAttribute("aria-expanded", "true");
    // Testing Library doesn't map <search> to the search role yet (browsers do), so look
    // the element up by the id the button points at.
    const searchBar = document.getElementById(searchButton.getAttribute("aria-controls") ?? "");
    await expect(searchBar?.tagName).toBe("SEARCH");

    await userEvent.type(input, "Milestone");
    await waitFor(() => expect(input).toHaveAccessibleDescription("Result 1 of 4"), {
      timeout: 5000,
    });

    // The first match is highlighted and scrolled into view.
    const pages = canvas.getByRole("region", { name: "Document" });
    await waitFor(async () => {
      await expect(activeHighlightText()).toBe("Milestone");
      const [range] = [...(CSS.highlights.get("rpv-search-active") ?? [])];
      await expect(range instanceof Range && isInView(range, pages)).toBe(true);
    });

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(input).toHaveAccessibleDescription("Result 2 of 4"));
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await waitFor(() => expect(input).toHaveAccessibleDescription("Result 1 of 4"));

    // Enter that confirms IME composition (Japanese, Chinese, …) must not move on.
    // Dispatched natively: Storybook's fireEvent wraps events in a synchronous act(),
    // which makes React warn about unawaited act calls.
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
    );
    await expect(input).toHaveAccessibleDescription("Result 1 of 4");

    // Escape closes the search, returns focus to the button, and clears the highlights.
    await userEvent.keyboard("{Escape}");
    await expect(searchButton).toHaveFocus();
    await expect(searchButton).not.toHaveAttribute("aria-controls");
    await expect(searchBar).not.toBeInTheDocument();
    await waitFor(() => expect(activeHighlightText()).toBeUndefined());
  },
};

export const SearchShortcut: Story = {
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    const pages = canvas.getByRole("region", { name: "Document" });
    pages.focus();

    await userEvent.keyboard("{Control>}f{/Control}");
    await expect(canvas.getByRole("searchbox")).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await expect(pages).toHaveFocus();
  },
};

export const Thumbnails: Story = {
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);
    const toggle = canvas.getByRole("button", { name: "Thumbnails" });
    await userEvent.click(toggle);

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).toHaveClass(
      "rpv-sidebar",
    );

    const thumbnails = await canvas.findByRole("navigation", { name: "Page thumbnails" });
    await waitFor(async () => {
      const rendered = [...thumbnails.querySelectorAll("canvas")].filter((c) => c.width > 0);
      await expect(rendered.length).toBeGreaterThan(0);
    });
    await expect(canvas.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await userEvent.click(canvas.getByRole("button", { name: "Page 3" }));
    await waitFor(() => expect(mountedPageNumbers(canvasElement)).toContain(3));
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Page number" })).toHaveValue("3"),
    );

    // Closing slides the sidebar out, then unmounts the thumbnails.
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.queryByRole("navigation")).toBeNull());
  },
};

/** Without a transition (reduced motion), `transitionend` never fires; content must still unmount. */
export const ThumbnailsWithoutAnimation: Story = {
  decorators: [
    (Story) => (
      <>
        <style>{".rpv-sidebar, .rpv-sidebar-inner { transition: none !important; }"}</style>
        <Story />
      </>
    ),
  ],
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    const toggle = canvas.getByRole("button", { name: "Thumbnails" });

    await userEvent.click(toggle);
    await canvas.findByRole("navigation", { name: "Page thumbnails" });

    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.queryByRole("navigation")).toBeNull(), { timeout: 500 });
  },
};

export const CursorMode: Story = {
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);
    const textMode = canvas.getByRole("radio", { name: "Text selection" });
    const handMode = canvas.getByRole("radio", { name: "Hand tool" });
    const pages = canvasElement.querySelector(".rpv-pages");
    await expect(textMode).toBeChecked();

    // A radio group: arrow keys move the selection.
    textMode.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(handMode).toBeChecked();
    await expect(handMode).toHaveFocus();
    await expect(pages).toHaveAttribute("data-cursor", "hand");

    await userEvent.keyboard("{ArrowLeft}");
    await expect(textMode).toBeChecked();
    await expect(pages).toHaveAttribute("data-cursor", "text");
  },
};

export const Zoom: Story = {
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    const zoom = canvas.getByRole("combobox", { name: "Zoom" });
    await expect(zoom).toHaveValue("page-fit");

    await userEvent.selectOptions(zoom, "1");
    await expect(zoom).toHaveValue("1");

    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await expect(zoom).toHaveValue("1.1");
    await expect(canvas.getByRole("option", { name: "110%" })).toBeInTheDocument();

    await userEvent.selectOptions(zoom, "page-width");
    await expect(zoom).toHaveValue("page-width");
  },
};

export const Download: Story = {
  args: { filename: "report.pdf" },
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);

    // Intercept the download link instead of actually saving a file.
    const downloads: string[] = [];
    const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    try {
      await userEvent.click(canvas.getByRole("button", { name: "Download" }));
      await waitFor(() => expect(downloads).toEqual(["report.pdf"]));
    } finally {
      click.mockRestore();
    }
  },
};

export const LoadError: Story = {
  args: { document: "Not a PDF" },
  async play({ canvas }) {
    const alert = await canvas.findByRole("alert", undefined, { timeout: 10_000 });
    await expect(alert).toHaveTextContent("This document couldn’t be opened.");
  },
};

/** The viewer follows the host page's `color-scheme`. */
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div style={{ colorScheme: "dark", height: "100%" }}>
        <Story />
      </div>
    ),
  ],
  async play({ canvas, canvasElement }) {
    await waitForDocument(canvas, 40);
    const toolbar = canvasElement.querySelector(".rpv-toolbar");
    if (!toolbar) throw new Error("toolbar not rendered");
    await expect(getComputedStyle(toolbar).backgroundColor).toBe("rgb(38, 38, 38)");
  },
};
