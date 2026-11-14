import {
  PdfPages,
  PdfViewerProvider,
  useFindShortcut,
  usePageField,
  useSearchField,
  type PdfSource,
  type SearchOptions,
} from "@brandenco/react-pdfjs-viewer/headless";
// The default UI's interaction logic, as hooks that return props to spread on your own
// elements, so your controls behave like the built-in ones:
//
// - usePageField: shows page labels ("iv"), Enter or leaving the field goes to the
//   typed page, Escape reverts, Enter that confirms an IME composition is ignored.
// - useSearchField: searches as you type, Enter / Shift+Enter go to the next / previous
//   match, Escape closes; plus result counts for the eye and for screen readers.
// - useFindShortcut: Cmd/Ctrl+F inside the element opens your search, not the browser's.
import { useRef, type ReactNode } from "react";

import { workerSrc } from "../pdf-worker.ts";

export function CustomControls({ src }: { src: PdfSource }): ReactNode {
  return (
    <PdfViewerProvider src={src} workerSrc={workerSrc} initialScale="page-width">
      <Viewer />
    </PdfViewerProvider>
  );
}

function Viewer(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useFindShortcut(ref); // by default it opens the search: useSearch().setOpen(true)

  return (
    <div ref={ref} className="headless">
      <div className="headless-toolbar">
        <PageField />
        <span className="headless-separator" />
        <SearchField />
      </div>
      <PdfPages className="headless-pages" />
    </div>
  );
}

function PageField(): ReactNode {
  const page = usePageField();
  return (
    <label className="example-field">
      Page
      <input {...page.inputProps} size={4} />
      <span>{page.countLabel}</span>
    </label>
  );
}

function SearchField(): ReactNode {
  const find = useSearchField({ debounce: 250 });
  const { search } = find;

  if (!search.isOpen) {
    return (
      <button
        type="button"
        onClick={() => search.setOpen(true)}
        aria-keyshortcuts="Control+F Meta+F"
      >
        Find… (⌘/Ctrl+F)
      </button>
    );
  }

  // Changing an option searches again with it. The checkboxes show `search.options`,
  // the options of the current search.
  function setOption(option: keyof SearchOptions, value: boolean): void {
    search.search(find.inputProps.value, { ...search.options, [option]: value }).catch(reportError);
  }

  return (
    <search className="example-search">
      {/* Focused when it appears, like the built-in search bar. */}
      {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
      <input {...find.inputProps} aria-label="Find in document" autoFocus />
      <span aria-hidden="true">{find.countLabel}</span>
      {/* A polite live region: the count is read out once the search is done and typing stopped. */}
      <span className="rpv-visually-hidden" aria-live="polite">
        {find.announcement}
      </span>
      <button type="button" disabled={search.matches.length === 0} onClick={search.previous}>
        Previous
      </button>
      <button type="button" disabled={search.matches.length === 0} onClick={search.next}>
        Next
      </button>
      <label>
        <input
          type="checkbox"
          checked={search.options.caseSensitive}
          onChange={(event) => setOption("caseSensitive", event.target.checked)}
        />
        Match case
      </label>
      <label>
        <input
          type="checkbox"
          checked={search.options.wholeWord}
          onChange={(event) => setOption("wholeWord", event.target.checked)}
        />
        Whole words
      </label>
      <button type="button" onClick={() => search.setOpen(false)}>
        Close
      </button>
    </search>
  );
}
