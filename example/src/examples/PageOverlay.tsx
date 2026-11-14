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
// Your own layer on each page, and your own cursor mode: bounding boxes drawn by hand.
//
// `renderPageOverlay` renders above the canvas, text and links, in a box the size of
// the page that follows zoom and rotation. `page.toPdfRect` / `page.toViewportRect`
// convert between on-screen px and PDF user space: boxes are stored in PDF units, so
// they survive zoom and rotation.
//
// The overlay ignores the pointer (text selection and links keep working beneath it);
// what should take input sets `pointer-events: auto`. `setMode` accepts any string, so
// "draw" is an app-defined mode: the viewer only sets `data-cursor="draw"` on the page
// list, for styling, and the overlay handles the input.
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

import { workerSrc } from "../pdf-worker.ts";

interface Box {
  id: number;
  pageIndex: number;
  /** PDF user space: [x1, y1, x2, y2]. */
  rect: [number, number, number, number];
}

interface BoxStore {
  boxes: readonly Box[];
  addBox: (pageIndex: number, rect: Box["rect"]) => void;
  clear: () => void;
}

const BoxesContext = createContext<BoxStore>({ boxes: [], addBox: () => {}, clear: () => {} });

export function PageOverlay({ src }: { src: PdfSource }): ReactNode {
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const nextId = useRef(1);
  const addBox = useCallback((pageIndex: number, rect: Box["rect"]) => {
    const id = nextId.current++;
    setBoxes((current) => [...current, { id, pageIndex, rect }]);
  }, []);
  const clear = useCallback(() => setBoxes([]), []);
  const store = useMemo(() => ({ boxes, addBox, clear }), [boxes, addBox, clear]);

  // Stable, because the pages are memoized: a new function re-renders every page.
  const renderPageOverlay = useCallback((page: PageOverlayInfo) => <BoxLayer page={page} />, []);

  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialScale={1} initialCursorMode="draw">
      <BoxesContext value={store}>
        <div className="headless">
          <Toolbar />
          <PdfPages
            className="headless-pages overlay-pages"
            renderPageOverlay={renderPageOverlay}
          />
        </div>
      </BoxesContext>
    </PdfViewerProvider>
  );
}

function Toolbar(): ReactNode {
  const { boxes, clear } = use(BoxesContext);
  const cursor = useCursorMode();
  const zoom = useZoom();
  const rotation = useRotation();

  return (
    <div className="headless-toolbar">
      <fieldset className="example-segmented">
        <legend className="rpv-visually-hidden">Cursor mode</legend>
        {(["draw", "text", "hand"] as const).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name="overlay-cursor"
              checked={cursor.mode === mode}
              onChange={() => cursor.setMode(mode)}
            />
            {mode === "draw" ? "Draw boxes" : mode === "text" ? "Select text" : "Hand tool"}
          </label>
        ))}
      </fieldset>
      <span className="headless-separator" />
      <button type="button" onClick={zoom.zoomOut}>
        Zoom out
      </button>
      <button type="button" onClick={zoom.zoomIn}>
        Zoom in
      </button>
      <button type="button" onClick={rotation.rotateClockwise}>
        Rotate
      </button>
      <span className="headless-separator" />
      <output>
        {boxes.length} {boxes.length === 1 ? "box" : "boxes"}
      </output>
      <button type="button" disabled={boxes.length === 0} onClick={clear}>
        Clear
      </button>
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
  const { boxes, addBox } = use(BoxesContext);
  const { mode } = useCursorMode(); // the viewer's hooks work inside overlays
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
          className="overlay-surface"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
      {boxes
        .filter((box) => box.pageIndex === page.pageIndex)
        .map((box) => (
          <div key={box.id} className="overlay-box" style={page.toViewportRect(box.rect)} />
        ))}
      {draft && <div className="overlay-box" data-draft="" style={draft} />}
    </>
  );
}
