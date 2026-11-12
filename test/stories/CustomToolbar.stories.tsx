import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
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
