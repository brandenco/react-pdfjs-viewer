import type { Meta, StoryObj } from "@storybook/react-vite";
import { PdfViewer, type PdfViewerProps } from "react-pdfjs-viewer";
import { expect, spyOn, waitFor, within } from "storybook/test";

import {
  documentArgType,
  loadDocument,
  loadedDocument,
  workerSrc,
  type DocumentArgs,
} from "../fixtures/documents.ts";
import {
  activeHighlightParts,
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

    // A wide toolbar shows its actions as buttons, with no "More actions" menu.
    await expect(canvas.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "More actions" })).toBeNull();

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
    const toggle = canvas.getByRole("button", { name: "Sidebar" });
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
    const toggle = canvas.getByRole("button", { name: "Sidebar" });

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

/**
 * Links in the document: to a position on another page, to a named destination, and out.
 * This document has page labels: pages 1 and 2 are "i" and "ii", page 3 is "1".
 */
export const Links: Story = {
  args: { document: "40 pages with extras", initialScale: "page-width" },
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);
    const pageField = canvas.getByRole("textbox", { name: "Page number" });
    const pages = canvas.getByRole("region", { name: "Document" });

    const links = await waitFor(
      () => {
        const found = canvasElement.querySelectorAll<HTMLAnchorElement>(
          '.rpv-page[data-page-number="1"] .rpv-annotation-layer a',
        );
        if (found.length !== 3) throw new Error(`${found.length} links rendered`);
        return [...found];
      },
      { timeout: 10_000 },
    );
    const [toMilestone, toLastPage, external] = links;

    // Screen readers announce each link by the text it covers on the page. (pdf.js names
    // internal links itself; external ones are named by the viewer.)
    await waitFor(async () => {
      await expect(toMilestone).toHaveAccessibleName("Go to milestone 2");
      await expect(toLastPage).toHaveAccessibleName("Go to the last page");
      await expect(external).toHaveAccessibleName("Visit example.com");
    });

    // External links open in a new tab, without access to the viewer's window.
    await expect(external).toHaveAttribute("href", "https://example.com/");
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(external).toHaveAttribute("rel", "noopener noreferrer nofollow");

    // An internal link scrolls to the exact spot it points at: milestone 2's line, near
    // the bottom of page 20 (labelled "18").
    await userEvent.click(toMilestone!);
    await waitFor(() => expect(pageField).toHaveValue("18"));
    await waitFor(async () => {
      const milestone = [
        ...canvasElement.querySelectorAll('.rpv-page[data-page-number="20"] .rpv-text-layer span'),
      ].find((span) => span.textContent === "Milestone 2");
      await expect(milestone && isInView(milestone, pages)).toBe(true);
    });
    // Page 20 fits the viewport's width, so it's shown whole rather than cut at the left.
    const page20 = canvasElement.querySelector('.rpv-page[data-page-number="20"]');
    await expect(page20?.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      pages.getBoundingClientRect().left,
    );

    // The page number stays on the target page, even though most of what's visible is
    // the next page, until the user scrolls themselves.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await expect(pageField).toHaveValue("18");
    pages.dispatchEvent(new WheelEvent("wheel"));
    pages.scrollTop += 100;
    await waitFor(() => expect(pageField).toHaveValue("19"));

    // A named destination.
    pages.dispatchEvent(new WheelEvent("wheel"));
    pages.scrollTop = 0;
    await waitFor(() => expect(pageField).toHaveValue("i"));
    await userEvent.click(toLastPage!);
    await waitFor(() => expect(pageField).toHaveValue("38"));
  },
};

/** `initialPage` opens the document at that page, before `<PdfPages>` has laid it out. */
export const InitialPage: Story = {
  args: { initialPage: 25 },
  async play({ canvas, canvasElement }) {
    await waitForDocument(canvas, 40);
    await expect(canvas.getByRole("textbox", { name: "Page number" })).toHaveValue("25");
    await waitFor(() => expect(mountedPageNumbers(canvasElement)).toContain(25));
    await expect(mountedPageNumbers(canvasElement)).not.toContain(1);
  },
};

/** Documents with an outline get an Outline view in the sidebar. */
export const Outline: Story = {
  args: { document: "40 pages with extras" },
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    await userEvent.click(canvas.getByRole("button", { name: "Sidebar" }));
    await userEvent.click(await canvas.findByRole("radio", { name: "Outline" }));

    const outline = canvas.getByRole("navigation", { name: "Outline" });
    // "Milestones" has no destination of its own: it's one button that expands and
    // collapses. The document asks for it to start expanded.
    const milestones = within(outline).getByRole("button", { name: "Milestones" });
    await expect(milestones).toHaveAttribute("aria-expanded", "true");

    const milestone3 = within(outline).getByRole("button", { name: "Milestone 3" });
    await userEvent.click(milestone3);
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: "Page number" })).toHaveValue("28"),
    );
    // The entry for the page being read is marked.
    await waitFor(() => expect(milestone3).toHaveAttribute("aria-current", "location"));

    // Collapsed, its parent stands in for it.
    await userEvent.click(milestones);
    await expect(milestones).toHaveAttribute("aria-expanded", "false");
    await expect(within(outline).queryByRole("button", { name: "Milestone 3" })).toBeNull();
    await expect(milestones.closest(".rpv-outline-row")).toHaveAttribute("data-contains-current");

    // The view sticks: closing and reopening the sidebar keeps showing the outline.
    await userEvent.click(canvas.getByRole("button", { name: "Sidebar" }));
    await userEvent.click(canvas.getByRole("button", { name: "Sidebar" }));
    await expect(await canvas.findByRole("radio", { name: "Outline" })).toBeChecked();
  },
};

/** Page labels: the page field shows and accepts them, with the page number alongside. */
export const PageLabels: Story = {
  args: { document: "40 pages with extras" },
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    const pageField = canvas.getByRole("textbox", { name: "Page number" });
    // Labels load just after the document.
    await canvas.findByText("(1 of 40)");
    await expect(pageField).toHaveValue("i");

    await userEvent.clear(pageField);
    await userEvent.type(pageField, "ii{Enter}");
    await expect(pageField).toHaveValue("ii");
    await expect(canvas.getByText("(2 of 40)")).toBeInTheDocument();

    await userEvent.clear(pageField);
    await userEvent.type(pageField, "10{Enter}");
    await expect(canvas.getByText("(12 of 40)")).toBeInTheDocument();
  },
};

/** Rotating turns every page, its text layer and its thumbnail. */
export const Rotation: Story = {
  args: { initialScale: 1 },
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);
    await waitForRenderedPage(canvasElement);
    const firstPage = canvasElement.querySelector<HTMLElement>(".rpv-page");
    if (!firstPage) throw new Error("no page rendered");
    const portrait = firstPage.getBoundingClientRect();
    await expect(portrait.height).toBeGreaterThan(portrait.width);

    await userEvent.click(canvas.getByRole("button", { name: "Rotate clockwise" }));
    await waitFor(async () => {
      const page = canvasElement.querySelector<HTMLElement>('.rpv-page[data-page-number="1"]');
      const rect = page?.getBoundingClientRect();
      await expect(rect?.width).toBeCloseTo(portrait.height, 0);
      await expect(rect?.height).toBeCloseTo(portrait.width, 0);
      // The re-rendered text layer is rotated into place, not left portrait.
      const textLayer = page?.querySelector(".rpv-text-layer");
      await expect(textLayer).toHaveAttribute("data-main-rotation", "90");
    });

    // Four quarter turns are back to the start.
    for (let turn = 0; turn < 3; turn++) {
      // oxlint-disable-next-line no-await-in-loop
      await userEvent.click(canvas.getByRole("button", { name: "Rotate clockwise" }));
    }
    await waitFor(() =>
      expect(canvasElement.querySelector(".rpv-page")?.getBoundingClientRect().height).toBeCloseTo(
        portrait.height,
        0,
      ),
    );
  },
};

/** Ctrl + wheel zooms the pages, keeping the point under the pointer in place. */
export const WheelZoom: Story = {
  args: { initialScale: 1 },
  async play({ canvas, canvasElement }) {
    await waitForDocument(canvas, 40);
    await waitForRenderedPage(canvasElement);
    const pages = canvas.getByRole("region", { name: "Document" });
    const zoom = canvas.getByRole<HTMLSelectElement>("combobox", { name: "Zoom" });
    const view = pages.getBoundingClientRect();
    const pointer = { clientX: view.left + view.width / 2, clientY: view.top + 200 };

    const pointUnder = (): { page: number; fraction: number } => {
      const element = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const page = element?.closest<HTMLElement>(".rpv-page");
      if (!page) throw new Error("no page under the pointer");
      const rect = page.getBoundingClientRect();
      return {
        page: Number(page.dataset["pageNumber"]),
        fraction: (pointer.clientY - rect.top) / rect.height,
      };
    };
    const before = pointUnder();

    const wheel = new WheelEvent("wheel", {
      ...pointer,
      deltaY: -50,
      ctrlKey: true,
      cancelable: true,
    });
    pages.dispatchEvent(wheel);
    await expect(wheel.defaultPrevented).toBe(true); // the web page itself doesn't zoom
    await waitFor(() => expect(Number(zoom.value)).toBeCloseTo(Math.exp(0.5), 2));

    const after = pointUnder();
    await expect(after.page).toBe(before.page);
    await expect(after.fraction).toBeCloseTo(before.fraction, 2);

    // Without Ctrl, the wheel scrolls as usual.
    const plain = new WheelEvent("wheel", { ...pointer, deltaY: 50, cancelable: true });
    pages.dispatchEvent(plain);
    await expect(plain.defaultPrevented).toBe(false);
  },
};

/** Print renders every page into a hidden frame and prints that. */
export const Print: Story = {
  // Printing renders every page at print resolution; a short document keeps this quick.
  args: { document: "3 pages" },
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 3);

    // Catch the print frame as it's added, and replace its print() with a check of what
    // it would print.
    const printed = new Promise<{ images: number; decoded: boolean }>((resolve) => {
      const observer = new MutationObserver(() => {
        const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Print preview"]');
        const frameWindow = frame?.contentWindow;
        if (!frameWindow) return;
        observer.disconnect();
        frameWindow.print = () => {
          const images = [...(frame.contentDocument?.images ?? [])];
          resolve({
            images: images.length,
            decoded: images.every((image) => image.naturalWidth > 0),
          });
          frameWindow.dispatchEvent(new Event("afterprint"));
        };
      });
      observer.observe(document.body, { childList: true });
    });

    const button = canvas.getByRole("button", { name: "Print" });
    await userEvent.click(button);
    await expect(await printed).toEqual({ images: 3, decoded: true });

    // The frame is removed once the dialog closes, and the button works again.
    await waitFor(() => expect(document.querySelector('iframe[title="Print preview"]')).toBeNull());
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Print" })).not.toHaveAttribute("aria-disabled"),
    );
  },
};

/**
 * Full screen shows the whole viewer (its shell). Browsers only go fullscreen for a real
 * user gesture, which test clicks aren't, so this checks what the button asks for.
 */
export const Fullscreen: Story = {
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);
    const button = canvas.getByRole("button", { name: "Full screen" });
    await expect(button).toHaveAttribute("aria-pressed", "false");

    const request = spyOn(Element.prototype, "requestFullscreen").mockResolvedValue();
    try {
      await userEvent.click(button);
      await expect(request).toHaveBeenCalledTimes(1);
      await expect(request.mock.contexts[0]).toBe(canvasElement.querySelector(".rpv-viewer"));
    } finally {
      request.mockRestore();
    }
  },
};

/**
 * Search matches text that's written differently from the query: a word hyphenated
 * across two lines, and an accented word. Highlights land on the original glyphs.
 */
export const SearchNormalization: Story = {
  args: { document: "40 pages with extras" },
  async play({ canvas, userEvent }) {
    await waitForDocument(canvas, 40);
    await userEvent.click(canvas.getByRole("button", { name: "Search" }));
    const input = canvas.getByRole("searchbox", { name: "Find in document" });

    // "hyphen-" ends one line and "ation" starts the next: one match, highlighted in both.
    await userEvent.type(input, "hyphenation");
    await waitFor(() => expect(input).toHaveAccessibleDescription("Result 1 of 1"), {
      timeout: 5000,
    });
    await waitFor(() => expect(activeHighlightParts()).toEqual(["hyphen-", "ation"]));

    // Accents are ignored by default: "cafe" finds "café".
    await userEvent.clear(input);
    await userEvent.type(input, "cafe");
    await waitFor(() => expect(input).toHaveAccessibleDescription("Result 1 of 1"), {
      timeout: 5000,
    });
    await waitFor(() => expect(activeHighlightText()).toBe("café"));
  },
};

/**
 * In a narrow viewer, rotate / full screen / print / download move into a "More actions"
 * menu: a menu button with the usual keyboard contract.
 */
export const NarrowToolbar: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 420, height: "100%" }}>
        <Story />
      </div>
    ),
  ],
  async play({ canvas, canvasElement, userEvent }) {
    await waitForDocument(canvas, 40);
    // Condensed to one row: no actions, cursor switch, zoom -/+ or page buttons; the
    // page field, zoom select and search stay.
    const hidden = ["Print", "Zoom in", "Next page"].filter((name) =>
      canvas.queryByRole("button", { name }),
    );
    await expect(hidden).toEqual([]);
    await expect(canvas.queryByRole("radiogroup", { name: "Cursor mode" })).toBeNull();
    await expect(canvas.getByRole("textbox", { name: "Page number" })).toBeVisible();
    await expect(canvas.getByRole("combobox", { name: "Zoom" })).toBeVisible();
    const toolbar = canvasElement.querySelector(".rpv-toolbar");
    await expect(toolbar?.getBoundingClientRect().height).toBeLessThan(60);

    // Page 1 is centered, although landscape pages later on make the list wider than
    // this narrow viewer.
    await waitForRenderedPage(canvasElement);
    const pages = canvas.getByRole("region", { name: "Document" });
    await waitFor(() => expect(pages.scrollWidth).toBeGreaterThan(pages.clientWidth));
    const firstPage = canvasElement.querySelector('.rpv-page[data-page-number="1"]');
    const pageBox = firstPage!.getBoundingClientRect();
    const viewBox = pages.getBoundingClientRect();
    const pageCenter = pageBox.left + pageBox.width / 2;
    const viewCenter = viewBox.left + pages.clientWidth / 2;
    await expect(Math.abs(pageCenter - viewCenter)).toBeLessThan(2);
    const trigger = canvas.getByRole("button", { name: "More actions" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Keyboard: Enter opens and moves into the menu; arrows, Home and End move.
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = await canvas.findByRole("menu", { name: "More actions" });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // This narrow, the cursor switch has moved into the menu too, as a checkbox item.
    const handTool = within(menu).getByRole("menuitemcheckbox", { name: "Hand tool" });
    await waitFor(() => expect(handTool).toHaveFocus());
    await expect(handTool).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard("{ArrowDown}");
    const rotate = within(menu).getByRole("menuitem", { name: "Rotate clockwise" });
    await expect(rotate).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(within(menu).getByRole("menuitem", { name: "Download" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(handTool).toHaveFocus();
    // Space toggles the hand tool and keeps the menu open.
    await userEvent.keyboard(" ");
    await expect(handTool).toHaveAttribute("aria-checked", "true");
    await expect(canvasElement.querySelector(".rpv-pages")).toHaveAttribute("data-cursor", "hand");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Escape closes it and returns focus to the button.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await expect(trigger).toHaveFocus();

    // Pointer: a click opens it (focus stays on the button); choosing an item runs it
    // and closes the menu.
    await userEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    await userEvent.click(canvas.getByRole("menuitem", { name: "Rotate clockwise" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() =>
      expect(canvasElement.querySelector(".rpv-text-layer")).toHaveAttribute(
        "data-main-rotation",
        "90",
      ),
    );

    // The menu sits under its button, not detached in the middle of the screen.
    await userEvent.click(trigger);
    const menuBox = (await canvas.findByRole("menu")).getBoundingClientRect();
    const triggerBox = trigger.getBoundingClientRect();
    await expect(menuBox.top).toBeGreaterThanOrEqual(triggerBox.bottom);
    await expect(menuBox.top - triggerBox.bottom).toBeLessThan(12);
    // Escape closes it from the button too (focus stays there after a pointer open).
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  },
};
