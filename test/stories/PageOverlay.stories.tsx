import {
  PdfPages,
  PdfViewerProvider,
  useCursorMode,
  useRotation,
  useZoom,
  type PageOverlayInfo,
  type PdfSource,
  type ViewportRect,
} from "@brandenco/react-pdfjs-viewer/headless";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { expect, waitFor } from "storybook/test";

import {
  documentArgType,
  loadDocument,
  loadedDocument,
  workerSrc,
  type DocumentArgs,
} from "../fixtures/documents.ts";
import { waitForRenderedPage } from "./helpers.ts";

/** A box drawn on a page, in PDF user space, so it survives zoom and rotation. */
interface Box {
  id: number;
  pageIndex: number;
  rect: [x1: number, y1: number, x2: number, y2: number];
}

const BoxesContext = createContext<{
  boxes: readonly Box[];
  addBox: (pageIndex: number, rect: Box["rect"]) => void;
}>({ boxes: [], addBox: () => {} });

/**
 * Bounding boxes drawn by hand: an app-defined "draw" cursor mode, and a page overlay
 * that shows the boxes and, in draw mode, a surface to draw them on.
 */
function BoundingBoxViewer({ src }: { src: PdfSource }): ReactNode {
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const nextId = useRef(1);
  const addBox = useCallback((pageIndex: number, rect: Box["rect"]) => {
    const id = nextId.current++;
    setBoxes((current) => [...current, { id, pageIndex, rect }]);
  }, []);
  const boxesContext = useMemo(() => ({ boxes, addBox }), [boxes, addBox]);
  const renderPageOverlay = useCallback((page: PageOverlayInfo) => <BoxLayer page={page} />, []);

  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialScale={1}>
      <BoxesContext value={boxesContext}>
        <style>{STYLES}</style>
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Toolbar boxCount={boxes.length} />
          <PdfPages style={{ flex: 1 }} renderPageOverlay={renderPageOverlay} />
        </div>
      </BoxesContext>
    </PdfViewerProvider>
  );
}

const STYLES = `
  .rpv-pages[data-cursor="draw"] { cursor: crosshair; }
  .box-layer-surface { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
  .box { position: absolute; box-sizing: border-box; border: 2px solid rgb(220, 38, 38);
         background: rgb(220 38 38 / 0.12); pointer-events: auto; }
  .box[data-draft] { border-style: dashed; }
`;

function Toolbar({ boxCount }: { boxCount: number }): ReactNode {
  const cursor = useCursorMode();
  const zoom = useZoom();
  const rotation = useRotation();
  return (
    <div style={{ display: "flex", gap: 8, padding: 8, alignItems: "center" }}>
      {(["text", "hand", "draw"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={cursor.mode === mode}
          onClick={() => cursor.setMode(mode)}
        >
          {mode[0]!.toUpperCase() + mode.slice(1)}
        </button>
      ))}
      <button type="button" onClick={zoom.zoomIn}>
        Zoom in
      </button>
      <button type="button" onClick={rotation.rotateClockwise}>
        Rotate
      </button>
      <output aria-label="Boxes">{boxCount} boxes</output>
    </div>
  );
}

/** The pointer's position in the overlay, kept inside the page. */
function pointAt(event: PointerEvent<HTMLElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
  };
}

function BoxLayer({ page }: { page: PageOverlayInfo }): ReactNode {
  const { boxes, addBox } = useContext(BoxesContext);
  const { mode } = useCursorMode();
  const [draft, setDraft] = useState<ViewportRect | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(event: PointerEvent<HTMLElement>): void {
    if (event.button !== 0) return;
    event.preventDefault(); // no text selection while drawing
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = pointAt(event);
    setDraft({ left: start.current.x, top: start.current.y, width: 0, height: 0 });
  }

  function onPointerMove(event: PointerEvent<HTMLElement>): void {
    const from = start.current;
    if (!from) return;
    const to = pointAt(event);
    setDraft({
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    });
  }

  function onPointerUp(): void {
    if (draft && draft.width > 3 && draft.height > 3) {
      addBox(page.pageIndex, page.toPdfRect(draft));
    }
    start.current = null;
    setDraft(null);
  }

  return (
    <>
      {mode === "draw" && (
        <div
          className="box-layer-surface"
          data-testid={`draw-surface-${page.pageNumber}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
      {boxes
        .filter((box) => box.pageIndex === page.pageIndex)
        .map((box) => (
          <div
            key={box.id}
            className="box"
            data-testid={`box-${box.id}`}
            style={page.toViewportRect(box.rect)}
          />
        ))}
      {draft && <div className="box" data-draft="" style={{ ...draft, pointerEvents: "none" }} />}
    </>
  );
}

const meta = {
  title: "Page overlay",
  args: { document: "40 pages" },
  argTypes: { document: documentArgType },
  loaders: [loadDocument],
  render: (_args, { loaded }) => <BoundingBoxViewer src={loadedDocument(loaded)} />,
} satisfies Meta<DocumentArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Draw mode adds a box; the box follows zoom and rotation; hand mode doesn't pan from it. */
export const DrawBoundingBoxes: Story = {
  async play({ canvas, canvasElement, userEvent }) {
    await waitForRenderedPage(canvasElement);
    const pages = canvasElement.querySelector<HTMLElement>(".rpv-pages")!;
    const firstPage = canvasElement.querySelector<HTMLElement>('.rpv-page[data-page-number="1"]')!;
    const overlay = firstPage.querySelector(".rpv-page-overlay");
    await expect(overlay).not.toBeNull();
    // The overlay lets the pointer through by default, so text stays selectable.
    await expect(getComputedStyle(overlay!).pointerEvents).toBe("none");

    await userEvent.click(canvas.getByRole("button", { name: "Draw" }));
    await expect(pages).toHaveAttribute("data-cursor", "draw");

    const surface = canvas.getByTestId("draw-surface-1");
    const origin = surface.getBoundingClientRect();
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target: surface, coords: { x: origin.x + 50, y: origin.y + 60 } },
      { target: surface, coords: { x: origin.x + 150, y: origin.y + 140 } },
      { keys: "[/MouseLeft]", target: surface, coords: { x: origin.x + 150, y: origin.y + 140 } },
    ]);
    await expect(canvas.getByRole("status", { name: "Boxes" })).toHaveTextContent("1 boxes");
    // Drawing cancels pointerdown; the page list still gets focus for keyboard scrolling.
    await expect(pages).toHaveFocus();

    const box = canvas.getByTestId("box-1");
    const drawn = box.getBoundingClientRect();
    await expect(drawn.width).toBeCloseTo(100, 0);
    await expect(drawn.height).toBeCloseTo(80, 0);

    // Stored in PDF units: zooming scales the box with the page.
    const pageWidth = firstPage.getBoundingClientRect().width;
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(firstPage.getBoundingClientRect().width).not.toBe(pageWidth));
    const ratio = firstPage.getBoundingClientRect().width / pageWidth;
    await expect(canvas.getByTestId("box-1").getBoundingClientRect().width).toBeCloseTo(
      100 * ratio,
      0,
    );

    // Rotating a quarter turn swaps the box's width and height.
    await userEvent.click(canvas.getByRole("button", { name: "Rotate" }));
    await waitFor(() =>
      expect(canvas.getByTestId("box-1").getBoundingClientRect().width).toBeCloseTo(80 * ratio, 0),
    );

    // Hand mode: a drag that starts on a box doesn't pan.
    await userEvent.click(canvas.getByRole("button", { name: "Hand" }));
    const target = canvas.getByTestId("box-1");
    const at = target.getBoundingClientRect();
    const scrollTop = pages.scrollTop;
    await userEvent.pointer([
      { keys: "[MouseLeft>]", target, coords: { x: at.x + 5, y: at.y + 5 } },
      { target, coords: { x: at.x + 5, y: at.y - 100 } },
      { keys: "[/MouseLeft]", target, coords: { x: at.x + 5, y: at.y - 100 } },
    ]);
    await expect(pages.scrollTop).toBe(scrollTop);
    await expect(pages).not.toHaveAttribute("data-dragging");
  },
};
