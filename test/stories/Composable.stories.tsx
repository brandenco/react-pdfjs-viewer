import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
  PdfPages,
  PdfThumbnails,
  PdfViewerProvider,
  useSearch,
  type PdfSource,
} from "react-pdfjs-viewer/headless";
import {
  PdfSearchBar,
  PdfSidebar,
  PdfToolbar,
  PdfViewer,
  PdfViewerBody,
  PdfViewerShell,
} from "react-pdfjs-viewer/ui";
import { expect, waitFor } from "storybook/test";

import {
  documentArgType,
  loadDocument,
  loadedDocument,
  workerSrc,
  type DocumentArgs,
} from "../fixtures/documents.ts";
import { waitForDocument } from "./helpers.ts";

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
