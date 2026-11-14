// The example app's shell: a list of examples and a document picker. Each example is
// self-contained in src/examples/ and gets the chosen document as `src`.
import { StrictMode, useState, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { PdfSource } from "react-pdfjs-viewer/headless";

import "react-pdfjs-viewer/ui.css";
import "./app.css";
import { CompleteViewer } from "./examples/CompleteViewer.tsx";
import { ComposedViewer } from "./examples/ComposedViewer.tsx";
import { CustomControls } from "./examples/CustomControls.tsx";
import { CustomToolbar } from "./examples/CustomToolbar.tsx";
import { DocumentData } from "./examples/DocumentData.tsx";
import { Headless } from "./examples/Headless.tsx";
import { PageOverlay } from "./examples/PageOverlay.tsx";
import { sampleDocument } from "./sample-document.ts";

interface Example {
  id: string;
  title: string;
  description: string;
  file: string;
  Component: (props: { src: PdfSource }) => ReactNode;
}

const EXAMPLES: readonly Example[] = [
  {
    id: "complete",
    title: "Complete viewer",
    description: "<PdfViewer> with its common props.",
    file: "CompleteViewer.tsx",
    Component: CompleteViewer,
  },
  {
    id: "composed",
    title: "Composed viewer",
    description: "The same pieces assembled by hand, with a sidebar of your own.",
    file: "ComposedViewer.tsx",
    Component: ComposedViewer,
  },
  {
    id: "toolbar",
    title: "Custom toolbar",
    description: "Your own toolbar from the built-in parts and ToolbarButton.",
    file: "CustomToolbar.tsx",
    Component: CustomToolbar,
  },
  {
    id: "headless",
    title: "Headless",
    description: "Hooks and rendering primitives only, no UI components.",
    file: "Headless.tsx",
    Component: Headless,
  },
  {
    id: "controls",
    title: "Custom controls",
    description: "usePageField, useSearchField and useFindShortcut on your own inputs.",
    file: "CustomControls.tsx",
    Component: CustomControls,
  },
  {
    id: "overlay",
    title: "Page overlay",
    description: "Draw bounding boxes with your own cursor mode and page layer.",
    file: "PageOverlay.tsx",
    Component: PageOverlay,
  },
  {
    id: "data",
    title: "Document data",
    description: "Properties, permissions, your own data, an outline tree, the store.",
    file: "DocumentData.tsx",
    Component: DocumentData,
  },
];

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The example named in the URL hash (`#overlay`), or the first. */
function useCurrentExample(): Example {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1));
  return EXAMPLES.find((example) => example.id === hash) ?? EXAMPLES[0]!;
}

function App(): ReactNode {
  const example = useCurrentExample();
  const [document, setDocument] = useState<{ name: string; src: PdfSource }>({
    name: "Sample document",
    src: sampleDocument,
  });

  async function openFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setDocument({ name: file.name, src: new Uint8Array(await file.arrayBuffer()) });
  }

  const { Component } = example;
  return (
    <div className="app">
      <nav className="app-nav" aria-label="Examples">
        <h1>react-pdfjs-viewer</h1>
        <ul>
          {EXAMPLES.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} aria-current={item === example ? "page" : undefined}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="app-document">
          <p>
            Showing <strong>{document.name}</strong>
          </p>
          <label className="app-file">
            Open a PDF…
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                openFile(event.target.files?.[0]).catch(reportError);
              }}
            />
          </label>
          {document.src !== sampleDocument && (
            <button
              type="button"
              onClick={() => setDocument({ name: "Sample document", src: sampleDocument })}
            >
              Back to the sample
            </button>
          )}
        </div>
      </nav>

      <main className="app-main">
        <header className="app-header">
          <h2>{example.title}</h2>
          <code>example/src/examples/{example.file}</code>
        </header>
        {/* Keyed, so switching examples starts each one fresh. */}
        <div className="app-example" key={example.id}>
          <Component src={document.src} />
        </div>
      </main>
    </div>
  );
}

createRoot(window.document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
