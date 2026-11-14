// Reading the document: properties and permissions, page labels, your own data with
// `useDocumentData`, an outline tree of your own, and the store for imperative access.
//
// Outline, labels, properties and permissions are read on first use, once per document,
// and shared by every component that asks.
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReactNode } from "react";
import {
  PdfPages,
  PdfViewerProvider,
  useDocumentData,
  useDocumentProperties,
  useOutline,
  useOutlineEntry,
  usePageLabels,
  usePdfDocument,
  usePdfViewerState,
  usePdfViewerStore,
  type Outline,
  type OutlineItem,
  type PdfSource,
} from "react-pdfjs-viewer/headless";

import { workerSrc } from "../pdf-worker.ts";

export function DocumentData({ src }: { src: PdfSource }): ReactNode {
  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialScale="page-fit">
      <div className="data-layout">
        <aside className="data-panel">
          <Properties />
          <Attachments />
          <OutlineTree />
          <StoreActions />
        </aside>
        <PdfPages className="headless-pages" />
      </div>
    </PdfViewerProvider>
  );
}

function Properties(): ReactNode {
  const { numPages } = usePdfDocument();
  const { status, data } = useDocumentProperties();
  const { labels } = usePageLabels();
  if (status !== "ready" || !data) return <p>Reading properties…</p>;

  const rows: [string, string][] = [
    ["Title", data.title ?? "—"],
    ["Author", data.author ?? "—"],
    ["Producer", data.producer ?? "—"],
    ["PDF version", data.pdfVersion ?? "—"],
    ["Pages", String(numPages)],
    ["Page labels", labels ? `${labels.slice(0, 4).join(", ")}, …` : "none"],
    // `null` means the document sets no restrictions.
    [
      "Printing",
      data.permissions ? (data.permissions.print ? "allowed" : "not allowed") : "allowed",
    ],
    ["Copying", data.permissions ? (data.permissions.copy ? "allowed" : "not allowed") : "allowed"],
  ];
  return (
    <section>
      <h3>Properties</h3>
      <dl className="data-list">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Your own data: `useDocumentData(load)` runs `load(document)` once per document and
// shares the result. `load` must be a module-level function: it's the cache key.
// `usePdfDocument().document` is the pdf.js document, for anything else.
async function loadAttachmentNames(doc: PDFDocumentProxy): Promise<string[]> {
  // `null` for documents without attachments.
  const attachments = await doc.getAttachments();
  return attachments ? [...attachments.keys()] : [];
}

function Attachments(): ReactNode {
  const { status, data: names } = useDocumentData(loadAttachmentNames);
  return (
    <section>
      <h3>Attachments</h3>
      {status === "ready" && names && <p>{names.length > 0 ? names.join(", ") : "None"}</p>}
    </section>
  );
}

function OutlineTree(): ReactNode {
  // One `useOutline()` at the root, passed down, so entries don't each subscribe.
  const outline = useOutline();
  return (
    <section>
      <h3>Outline</h3>
      {outline.status === "ready" && outline.items.length === 0 && <p>None</p>}
      <OutlineList outline={outline} items={outline.items} />
    </section>
  );
}

function OutlineList(props: { outline: Outline; items: readonly OutlineItem[] }): ReactNode {
  if (props.items.length === 0) return null;
  return (
    <ul className="data-outline">
      {props.items.map((item, index) => (
        // Outline entries have no ids, and titles needn't be unique.
        // oxlint-disable-next-line react/no-array-index-key
        <OutlineEntry key={index} outline={props.outline} item={item} />
      ))}
    </ul>
  );
}

function OutlineEntry(props: { outline: Outline; item: OutlineItem }): ReactNode {
  const { outline, item } = props;
  const entry = useOutlineEntry(outline, item);
  return (
    <li>
      {entry.hasChildren && (
        <button type="button" aria-expanded={entry.isExpanded} onClick={entry.toggle}>
          {entry.isExpanded ? "▾" : "▸"}
          <span className="rpv-visually-hidden">Subsections of {item.title}</span>
        </button>
      )}
      <button
        type="button"
        disabled={!entry.canNavigate}
        aria-current={entry.isCurrent ? "location" : undefined}
        data-contains-current={entry.containsCurrent ? "" : undefined}
        onClick={entry.select}
      >
        {item.title}
      </button>
      {entry.isExpanded && <OutlineList outline={outline} items={item.items} />}
    </li>
  );
}

/**
 * The store, for imperative access: every action is a method. `usePdfViewerState`
 * subscribes to any slice of the state (the selector must return existing values, not
 * build new objects).
 */
function StoreActions(): ReactNode {
  const store = usePdfViewerStore();
  const rotation = usePdfViewerState((state) => state.rotation);
  const numPages = usePdfViewerState((state) => state.numPages);
  return (
    <section>
      <h3>Store</h3>
      <div className="data-actions">
        <button type="button" onClick={() => store.goToPage(5)}>
          Go to page 5
        </button>
        <button type="button" onClick={() => store.goToPage(numPages)}>
          Last page
        </button>
        <button type="button" onClick={() => store.setRotation(rotation + 90)}>
          Rotate ({rotation}°)
        </button>
        <button type="button" onClick={() => void store.search("milestone")}>
          Search “milestone”
        </button>
      </div>
    </section>
  );
}
