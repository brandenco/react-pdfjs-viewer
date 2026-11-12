import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState, type ReactNode } from "react";
import {
  PdfPages,
  PdfSidebar,
  PdfThumbnails,
  PdfViewerProvider,
  useCursorMode,
  usePageNavigation,
  useSearch,
  useSidebar,
  useZoom,
  type PdfSource,
} from "react-pdfjs-viewer";
import { useFindShortcut, usePageField, useSearchField } from "react-pdfjs-viewer/headless";
import { expect, waitFor } from "storybook/test";

import {
  documentArgType,
  loadDocument,
  loadedDocument,
  workerSrc,
  type DocumentArgs,
} from "../fixtures/documents.ts";
import { activeHighlightText, waitForRenderedPage } from "./helpers.ts";

/**
 * The same building blocks as `<PdfViewer>`, laid out by hand with a deliberately plain
 * toolbar built only from the public hooks. This is the "bring your own toolbar" setup.
 */
function CustomViewer({ src }: { src: PdfSource }): ReactNode {
  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialScale="page-width">
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <PlainToolbar />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <PdfSidebar width={140}>
            <PdfThumbnails width={96} />
          </PdfSidebar>
          <PdfPages style={{ flex: 1 }} />
        </div>
      </div>
    </PdfViewerProvider>
  );
}

function PlainToolbar(): ReactNode {
  const sidebar = useSidebar();
  const navigation = usePageNavigation();
  const zoom = useZoom();
  const cursor = useCursorMode();
  const search = useSearch();
  const [query, setQuery] = useState("");

  return (
    <div style={{ display: "flex", gap: 8, padding: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" aria-expanded={sidebar.isOpen} onClick={sidebar.toggle}>
        Pages
      </button>
      <button type="button" disabled={!navigation.canGoPrevious} onClick={navigation.previousPage}>
        Previous
      </button>
      <output aria-label="Current page">
        {navigation.currentPage} / {navigation.numPages}
      </output>
      <button type="button" disabled={!navigation.canGoNext} onClick={navigation.nextPage}>
        Next
      </button>
      <button type="button" onClick={zoom.zoomOut}>
        Zoom out
      </button>
      <output aria-label="Zoom level">{Math.round(zoom.scale * 100)}%</output>
      <button type="button" onClick={zoom.zoomIn}>
        Zoom in
      </button>
      <button type="button" aria-pressed={cursor.mode === "hand"} onClick={cursor.toggle}>
        Hand tool
      </button>
      <search>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (query === search.query) search.next();
            else void search.search(query);
          }}
        >
          <label>
            Find <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>{" "}
          <output aria-label="Search results">
            {search.matches.length > 0 && `${search.activeIndex + 1} of ${search.matches.length}`}
          </output>
        </form>
      </search>
    </div>
  );
}

const meta = {
  title: "Custom toolbar (hooks)",
  args: { document: "40 pages" },
  argTypes: { document: documentArgType },
  loaders: [loadDocument],
  render: (_args, { loaded }) => <CustomViewer src={loadedDocument(loaded)} />,
} satisfies Meta<DocumentArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HooksOnly: Story = {
  async play({ canvas, canvasElement, userEvent }) {
    const currentPage = canvas.getByRole("status", { name: "Current page" });
    await waitFor(() => expect(currentPage).toHaveTextContent("1 / 40"), { timeout: 20_000 });
    await waitForRenderedPage(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(currentPage).toHaveTextContent("2 / 40"));

    const zoomLevel = canvas.getByRole("status", { name: "Zoom level" });
    const before = zoomLevel.textContent;
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(zoomLevel.textContent).not.toBe(before));

    const handTool = canvas.getByRole("button", { name: "Hand tool" });
    await userEvent.click(handTool);
    await expect(handTool).toHaveAttribute("aria-pressed", "true");

    await userEvent.type(canvas.getByRole("textbox", { name: "Find" }), "Milestone 3{Enter}");
    const results = canvas.getByRole("status", { name: "Search results" });
    await waitFor(() => expect(results).toHaveTextContent("1 of 1"), { timeout: 5000 });
    await waitFor(() => expect(activeHighlightText()).toBe("Milestone 3"));
  },
};

/**
 * The interaction hooks on plain HTML elements: the page field and search field logic of
 * the default UI, with none of its components or styles.
 */
function InteractionToolbar(): ReactNode {
  const page = usePageField();
  const find = useSearchField();
  const rootRef = useRef<HTMLDivElement>(null);
  useFindShortcut(rootRef);

  return (
    <div ref={rootRef} style={{ display: "flex", gap: 8, padding: 8, alignItems: "center" }}>
      <label>
        Go to page <input {...page.inputProps} size={4} />
      </label>
      <span>{page.countLabel}</span>
      {find.search.isOpen && (
        <label>
          Search <input {...find.inputProps} />
        </label>
      )}
      <output aria-label="Result count">{find.countLabel}</output>
      <output aria-label="Announcement">{find.announcement}</output>
      <PdfPages style={{ position: "fixed", inset: "60px 16px 16px", height: "auto" }} />
    </div>
  );
}

export const InteractionHooks: Story = {
  args: { document: "40 pages with extras" },
  render: (_args, { loaded }) => (
    <PdfViewerProvider src={loadedDocument(loaded)} workerSrc={workerSrc}>
      <InteractionToolbar />
    </PdfViewerProvider>
  ),
  async play({ canvas, userEvent }) {
    // The page field shows labels, and accepts them.
    const pageField = canvas.getByRole("textbox", { name: "Go to page" });
    await waitFor(() => expect(pageField).toHaveValue("i"), { timeout: 20_000 });
    await userEvent.clear(pageField);
    await userEvent.type(pageField, "5{Enter}");
    await expect(canvas.getByText("(7 of 40)")).toBeInTheDocument();
    // Escape reverts what was typed.
    await userEvent.clear(pageField);
    await userEvent.type(pageField, "30{Escape}");
    await expect(pageField).toHaveValue("5");

    // Cmd/Ctrl+F (scoped to the toolbar here) opens the search, which searches as you type.
    pageField.focus();
    await userEvent.keyboard("{Control>}f{/Control}");
    const searchField = await canvas.findByRole("searchbox", { name: "Search" });
    await userEvent.type(searchField, "Milestone");
    const typedAt = performance.now();
    // The count shows as soon as the search is done, but the announcement waits until
    // typing has stopped for 500ms, so screen readers don't read a count per pause.
    const announcement = canvas.getByRole("status", { name: "Announcement" });
    await waitFor(
      () => expect(canvas.getByRole("status", { name: "Result count" })).toHaveTextContent("/ 5"),
      { timeout: 5000 },
    );
    if (performance.now() - typedAt < 450) await expect(announcement).toBeEmptyDOMElement();
    // Five matches (page 1 links to "milestone 2" too). The reader is on page 7, so the
    // first one after it is active: milestone 1, on page 10.
    await waitFor(
      () =>
        expect(canvas.getByRole("status", { name: "Announcement" })).toHaveTextContent(
          "Result 2 of 5",
        ),
      {
        timeout: 5000,
      },
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.getByRole("status", { name: "Result count" })).toHaveTextContent("3 / 5"),
    );

    // Escape closes it, by default through the shared search state.
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("searchbox")).toBeNull();
  },
};
