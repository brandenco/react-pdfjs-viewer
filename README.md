# react-pdfjs-viewer

A virtualized React PDF viewer built on [`pdfjs-dist`](https://github.com/mozilla/pdf.js),
usable three ways, all running on the same viewer engine:

1. **Complete viewer**: `<PdfViewer src="…" />`, with toolbar, sidebar and search.
2. **Composable**: the same pieces (toolbar, buttons, sidebar, outline, search bar),
   arranged your way.
3. **Headless**: hooks and rendering primitives, with no opinionated UI or its CSS in
   your bundle.

Features:

- **Virtualized**: only pages near the viewport are mounted. Off-screen canvases are
  released, and fast scroll-bys never render. Page 1 shows immediately; the other page
  sizes stream in afterwards without the scroll position jumping.
- **Navigation**: page numbers and page labels ("iv", "A-1"), clickable links (within
  the document and out), the document outline, and named destinations.
- **Zoom**: steps, fit page / fit width, Ctrl/⌘ + wheel and trackpad pinch around the
  pointer.
- **Search**: streams results on large documents, highlights with the CSS Custom
  Highlight API.
- **Also**: rotation, printing, full screen, download, text selection / hand tool,
  virtualized thumbnails, document properties and permissions.
- **Styles stay isolated**: all CSS lives in the `rpv` cascade layer, so it never
  overrides your styles and any of your rules can override it.
- **SSR-safe**: pdf.js is lazy-loaded on the client.

## Getting started

Peer dependencies: `react` / `react-dom` 19+ and `pdfjs-dist` 6.x (tested on 6.0 through 6.5).

```sh
npm install react-pdfjs-viewer pdfjs-dist
```

```tsx
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"; // see "pdf.js worker" below
import { PdfViewer } from "react-pdfjs-viewer/ui";

import "react-pdfjs-viewer/ui.css"; // once, anywhere in your app; see "Styling"

<div style={{ height: 800 }}>
  <PdfViewer src="/file.pdf" workerSrc={workerSrc} />
</div>;
```

The viewer fills its container, so give the container a height. `src` takes a URL, a
`URL`, or the bytes (`Uint8Array` / `ArrayBuffer`). Other props:

```tsx
<PdfViewer
  src={src}
  workerSrc={workerSrc}
  initialScale="page-width" // a number (1 = 100%), "page-fit" (default) or "page-width"
  initialPage={3}
  initialSidebarOpen
  filename="report.pdf" // for downloads
  documentOptions={{ password, cMapUrl, httpHeaders }} // passed to pdf.js getDocument()
  onDocumentLoad={(document) => {}}
  onError={(error) => {}}
/>
```

### pdf.js worker

pdf.js parses documents in a web worker, whose script your bundler has to serve. Pass its
URL as `workerSrc`:

```tsx
// Vite
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// webpack 5, Next.js, Rspack, Parcel
const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
// Or a copy you host yourself (it must match your pdfjs-dist version)
const workerSrc = "/pdf.worker.min.mjs";
```

`workerSrc` sets pdf.js' page-wide `GlobalWorkerOptions.workerSrc`. If you already set that
yourself, leave `workerSrc` out. To share one worker between documents, pass a `PDFWorker`
as `documentOptions={{ worker }}`.

## Entry points

| Import                        | What's in it                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `react-pdfjs-viewer/headless` | The provider, the store, every hook, and the rendering primitives `PdfPages` and `PdfThumbnails`.                             |
| `react-pdfjs-viewer/ui`       | The opinionated components: `PdfViewer`, `PdfToolbar` and its buttons, `PdfSidebar`, `PdfOutline`, `PdfSearchBar`, the shell. |
| `react-pdfjs-viewer`          | Both of the above.                                                                                                            |
| `react-pdfjs-viewer/core.css` | The styles the viewer needs to work.                                                                                          |
| `react-pdfjs-viewer/ui.css`   | `core.css` plus the default look.                                                                                             |

No JavaScript module imports CSS: you import one of the two stylesheets yourself (see
"Styling"). Production bundlers drop whatever JavaScript you don't use, from any entry
point. The subpaths also keep **dev servers**, which don't tree-shake, from loading UI
code you don't use, so prefer them. Sizes, minified and gzipped, without pdf.js (a lazily loaded peer
dependency), as checked by `pnpm test:bundle`:

| You use                   | JS      |
| ------------------------- | ------- |
| The provider and one hook | 5.5 kB  |
| `PdfPages` and a hook     | 11.0 kB |
| `<PdfViewer>`             | 19.1 kB |

## Composing your own viewer

Everything inside `<PdfViewer>` is exported. This is `<PdfViewer>`, assembled by hand:

```tsx
import { PdfPages, PdfThumbnails, PdfViewerProvider } from "react-pdfjs-viewer/headless";
import {
  PdfSearchBar,
  PdfSidebar,
  PdfToolbar,
  PdfViewerBody,
  PdfViewerShell,
} from "react-pdfjs-viewer/ui";

<PdfViewerProvider src={src} workerSrc={workerSrc}>
  <PdfViewerShell>
    <PdfToolbar />
    <PdfViewerBody>
      <PdfSidebar>
        <PdfThumbnails />
      </PdfSidebar>
      <PdfPages />
      <PdfSearchBar />
    </PdfViewerBody>
  </PdfViewerShell>
</PdfViewerProvider>;
```

No wiring props are needed: the pieces share state through the provider (the toolbar's
search button opens the search bar, for example). `PdfViewerShell` adds the frame,
Cmd/Ctrl+F for search, and links the toolbar to the sidebar and search bar with
`aria-controls`. Without it, the pieces still work; lay them out with your own CSS.

**Replacing the toolbar.** Pass your own to `<PdfViewer toolbar={…}>`, or build one from
the toolbar's parts: `SidebarToggleButton`, `PageControls`, `ZoomControls`,
`CursorModeSwitch`, `SearchToggleButton`, `RotateButton`, `FullscreenButton`,
`PrintButton`, `DownloadButton`, and `ToolbarButton` for your own. Each only uses public
hooks:

```tsx
import { useZoom } from "react-pdfjs-viewer/headless";
import {
  PageControls,
  PrintButton,
  SearchToggleButton,
  SidebarToggleButton,
  ToolbarButton,
  ZoomControls,
} from "react-pdfjs-viewer/ui";

function MyToolbar() {
  const { setScale } = useZoom();
  return (
    <div className="my-toolbar">
      <SidebarToggleButton />
      <PageControls />
      <ZoomControls />
      <ToolbarButton label="Actual size" onClick={() => setScale(1)}>
        1:1
      </ToolbarButton>
      <SearchToggleButton />
      <PrintButton />
    </div>
  );
}

<PdfViewer src={src} workerSrc={workerSrc} toolbar={<MyToolbar />} />;
```

**Sidebar views.** `<PdfViewer>` shows thumbnails, plus the outline for documents that
have one. In your own sidebar, switch on `useSidebar().view`:

```tsx
import { PdfThumbnails, useSidebar } from "react-pdfjs-viewer/headless";
import { PdfOutline, PdfSidebar, PdfSidebarViewSwitch } from "react-pdfjs-viewer/ui";

function Sidebar() {
  const { view } = useSidebar();
  return (
    <PdfSidebar width={220}>
      <PdfSidebarViewSwitch />
      {view === "outline" ? <PdfOutline /> : <PdfThumbnails />}
    </PdfSidebar>
  );
}
```

## Headless

Build any interface on the hooks. They must be used inside `<PdfViewerProvider>`, and
`<PdfPages>` (or your own renderer, see below) shows the pages. Nothing from
`react-pdfjs-viewer/ui` ends up in your bundle. Import `core.css` for the page layout,
text selection and search highlights, and style everything else yourself.

```tsx
import "react-pdfjs-viewer/core.css";
import {
  PdfPages,
  PdfViewerProvider,
  usePageNavigation,
  useZoom,
} from "react-pdfjs-viewer/headless";

function Toolbar() {
  const { currentPage, numPages, nextPage, previousPage } = usePageNavigation();
  const { zoomIn, zoomOut } = useZoom();
  return (
    <div>
      <button onClick={previousPage}>Previous</button>
      <span>
        {currentPage} / {numPages}
      </span>
      <button onClick={nextPage}>Next</button>
      <button onClick={zoomOut}>−</button>
      <button onClick={zoomIn}>+</button>
    </div>
  );
}

<PdfViewerProvider src={src} workerSrc={workerSrc}>
  <Toolbar />
  <PdfPages style={{ height: 800 }} />
</PdfViewerProvider>;
```

Each hook subscribes only to the state it returns, so a component re-renders only when
that changes. Actions (`goToPage`, `zoomIn`, …) keep their identity across renders, so
they're safe to pass to `onClick` or list in effect dependencies.

| Hook                      | Returns                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePageNavigation()`     | `currentPage`, `numPages`, `canGoPrevious`, `canGoNext`, `goToPage(n)`, `nextPage`, `previousPage`, `firstPage`, `lastPage`, `goToDestination(dest)`                                                                          |
| `useZoom()`               | `scale`, `mode`, `minScale`, `maxScale`, `canZoomIn`, `canZoomOut`, `setScale`, `zoomIn`, `zoomOut`, `zoomTo("page-fit" \| "page-width")`                                                                                     |
| `useSearch()`             | `query`, `options`, `status`, `matches`, `activeIndex`, `pagesSearched`, `search(query, { caseSensitive, wholeWord })`, `next`, `previous`, `setActiveMatch`, `clear`, and the search bar's `isOpen`, `setOpen`, `toggleOpen` |
| `useRotation()`           | `rotation`, `setRotation(degrees)`, `rotateClockwise`, `rotateCounterClockwise`                                                                                                                                               |
| `useCursorMode()`         | `mode` (`"text"` \| `"hand"`), `setMode`, `toggle`                                                                                                                                                                            |
| `useSidebar()`            | `isOpen`, `setOpen`, `toggle`, `view` (`"thumbnails"` \| `"outline"`), `setView`                                                                                                                                              |
| `useDownload()`           | `download(filename?)`, `canDownload`, `isDownloading`                                                                                                                                                                         |
| `usePrint()`              | `print({ dpi })`, `cancel`, `canPrint`, `isPrinting`, `progress`                                                                                                                                                              |
| `useFullscreen(ref)`      | `isFullscreen`, `isSupported`, `enter`, `exit`, `toggle`, for the element in `ref`                                                                                                                                            |
| `useOutline()`            | `status`, `items` (nested), `goToItem(item)`                                                                                                                                                                                  |
| `usePageLabels()`         | `labels`, `labelOf(pageNumber)`, `pageNumberOf(label)`                                                                                                                                                                        |
| `useDocumentProperties()` | `{ status, data }`: title, author, subject, dates, producer, `permissions`, `pageLabels`, raw `info` and XMP `metadata`                                                                                                       |
| `usePdfDocument()`        | `status`, `error`, `numPages`, and the pdf.js `document`                                                                                                                                                                      |

Outline, labels, properties and permissions are read from the document on first use,
once per document, and shared by every component that asks.

**Building your own controls.** The default UI's interaction logic is available as hooks
that return props to spread on your own elements, so your controls behave the same:

```tsx
import { useRef } from "react";
import { usePageField, useSearchField, useFindShortcut } from "react-pdfjs-viewer/headless";

function Controls() {
  const page = usePageField(); // labels, typing, Enter / Escape, IME-safe
  const find = useSearchField({ debounce: 250 }); // search as you type, Enter / Shift+Enter, Escape
  const ref = useRef<HTMLDivElement>(null);
  useFindShortcut(ref); // Cmd/Ctrl+F opens the search instead of the browser's

  return (
    <div ref={ref}>
      <input {...page.inputProps} aria-label="Page" /> {page.countLabel}
      {find.search.isOpen && <input {...find.inputProps} aria-label="Find" />}
      <output aria-label="Results">{find.countLabel}</output>
    </div>
  );
}
```

`useSearchField` also returns `spokenCountLabel` ("Result 3 of 12") and `announcement`
(for an `aria-live` region; filled in once the search is done). For an outline tree of
your own, `useOutlineEntry(outline, item)` gives each entry its expanded state, whether
it's the current one (or a collapsed parent of it), and `select()`.

**Rendering primitives.** `<PdfPages>` is the scrollable, virtualized page list, with
canvas, selectable text, search highlights and clickable links. `<PdfThumbnails>` is the
virtualized thumbnail list. Both are unstyled beyond layout, and take `className` and
`style`. `PdfPages` props include `gap`, `overscan`, `renderDelay`, `maxCanvasPixels`,
`annotations` (`false` skips the link layer), `externalLinkTarget` (default `"_blank"`),
`loadingFallback` and `errorFallback`.

**Printing and permissions.** pdf.js doesn't enforce a document's permissions. This
library respects the print permission: `usePrint().canPrint` is false and `print()`
refuses when the document disallows printing, unless you pass
`print({ ignorePermissions: true })`. The other permissions are reported by
`useDocumentProperties()` for you to act on.

## Advanced: pdf.js and the store

- **pdf.js directly.** `usePdfDocument().document` is the pdf.js `PDFDocumentProxy`, for
  anything this library doesn't wrap (`getPage`, `getAttachments`, `saveDocument`, …).
- **Your own document data.** `useDocumentData(load)` runs `load(document)` once per
  document and shares the result, like `useOutline` does. `load` must be a module-level
  function: it's the cache key.

  ```tsx
  import type { PDFDocumentProxy } from "pdfjs-dist";
  import { useDocumentData } from "react-pdfjs-viewer/headless";

  const loadAttachments = (doc: PDFDocumentProxy) => doc.getAttachments();

  function Attachments() {
    const { status, data } = useDocumentData(loadAttachments);
    // …
  }
  ```

- **State outside the hooks.** `usePdfViewerState(selector)` subscribes to any slice of
  `ViewerState`; the selector must return existing values, not build new objects.
  `usePdfViewerStore()` returns the `PdfViewerStore`, with every action as a method
  (`store.goToPage(5)`, `store.setRotation(90)`, `store.getState()`, `store.subscribe()`).
- **Your own page renderer.** Navigation, search and fit zoom scroll through a
  `PageScroller`. `<PdfPages>` registers one; a custom renderer (say, a single-page view)
  can implement `PageScroller` and register with `store.attachScroller(scroller)`, then
  report `store.reportCurrentPage(n)` as it scrolls and `store.reportViewportResize()`
  when it resizes.

## Styling

Import one stylesheet, once (in your app's entry, or a global CSS file):

| Stylesheet                    | Use it when                                                                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-pdfjs-viewer/ui.css`   | You use the UI components and want the default look. Includes `core.css`.                                                                                                                                                                      |
| `react-pdfjs-viewer/core.css` | You style everything yourself (headless, or the UI components restyled from scratch). Only what the viewer needs to work: page layout for virtualization, the selectable text and link layers, search highlights, the thumbnail list's layout. |

Without either, `<PdfPages>` warns in the console. Every rule is in a cascade layer
(`rpv.core`, `rpv.ui`) and every selector is wrapped in `:where()`, so it has zero
specificity. Your styles win:

- **Plain CSS** that isn't in a layer always beats ours, at any specificity.
- **In a layer**, place ours below yours. With Tailwind v4, for example, import ours into
  its `components` layer so utility classes override it:

  ```css
  @import "tailwindcss";
  @import "react-pdfjs-viewer/ui.css" layer(components);
  ```

  Even in the same layer as yours, our zero-specificity rules lose to any selector you
  write.

**Theming.** Set the `--rpv-*` tokens on the viewer or any ancestor (including `:root`);
they apply to everything inside. The defaults follow the page's `color-scheme` through
`light-dark()`: `--rpv-background`, `--rpv-surface`, `--rpv-surface-muted`,
`--rpv-surface-active`, `--rpv-text`, `--rpv-text-muted`, `--rpv-border`, `--rpv-accent`,
`--rpv-radius`, `--rpv-duration`, `--rpv-page-background`, `--rpv-page-shadow`, and,
from `core.css`, `--rpv-highlight`, `--rpv-highlight-active`, `--rpv-highlight-underline`,
`--rpv-selection`.

**`className` and `style`.** Every component takes both, on its root element. Your class
is added to ours, never replaces it. That also makes style helpers that return both work
directly, such as StyleX's: `<PdfToolbar {...stylex.props(styles.toolbar)} />`.

**What to target.** These class names and state attributes are public API and stay
stable across minor versions; anything else in the markup may change.

| Element                                 | Class                                        | State                                            |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| Viewer frame (`PdfViewerShell`)         | `rpv-viewer`                                 |                                                  |
| Row under the toolbar (`PdfViewerBody`) | `rpv-viewer-body`                            |                                                  |
| Page list (`PdfPages`)                  | `rpv-pages`                                  | `data-cursor="text" \| "hand"`, `data-dragging`  |
| One page                                | `rpv-page`                                   | `data-page-number`                               |
| Loading / error message                 | `rpv-status`                                 |                                                  |
| Thumbnail list (`PdfThumbnails`)        | `rpv-thumbnails`                             |                                                  |
| One thumbnail (button)                  | `rpv-thumbnail`                              | `data-current`                                   |
| Thumbnail image / label                 | `rpv-thumbnail-image`, `rpv-thumbnail-label` |                                                  |
| Toolbar                                 | `rpv-toolbar`                                |                                                  |
| Toolbar group / separator               | `rpv-toolbar-group`, `rpv-toolbar-separator` |                                                  |
| Any toolbar button                      | `rpv-button`                                 | `aria-disabled`, `aria-pressed`, `aria-expanded` |
| Page field and its buttons              | `rpv-page-controls`                          |                                                  |
| Zoom buttons and select                 | `rpv-zoom-controls`                          |                                                  |
| Cursor mode switch                      | `rpv-segmented`                              |                                                  |
| Search bar                              | `rpv-search-bar`                             |                                                  |
| Sidebar                                 | `rpv-sidebar`                                | `data-open`                                      |
| Sidebar view tabs                       | `rpv-sidebar-views`                          |                                                  |
| Outline                                 | `rpv-outline`                                |                                                  |
| One outline row                         | `rpv-outline-row`                            | `data-current`, `data-contains-current`          |
| Outline entry title / chevron           | `rpv-outline-title`, `rpv-outline-toggle`    | `aria-expanded`, `aria-current="location"`       |

## Development

Requires pnpm 12 (pinned in `packageManager`); pnpm downloads the pinned Node runtime
(`devEngines.runtime`, Node 26 LTS) for scripts automatically.

```sh
pnpm install
pnpm exec playwright install chromium   # once, for browser tests
pnpm storybook      # stories on http://localhost:6006: every viewer state, plus a11y panel
pnpm test           # everything below
pnpm test:main      # unit tests + every story as a browser test (axe included)
pnpm test:compat    # the stories again, against pdf.js 6.0
pnpm test:watch     # unit tests + stories, re-running what changed
pnpm check          # tsc (TypeScript 7) + type-aware oxlint + oxfmt --check
pnpm build          # tsc → dist/ (ESM + .d.ts) and the CSS files
pnpm test:bundle    # builds dist/, then bundles small consumer apps against it
pnpm lint:pkg       # publint + are-the-types-wrong against the packed tarball
```

Tests live in `test/`:

- `test/unit/`: Vitest unit tests for `src/core/` (Node, with pdf.js' Node build for the
  tests that read real documents).
- `test/stories/`: Storybook stories. Each story is also a test: Vitest renders it in
  Chromium, runs its `play` function, then runs axe; any accessibility violation fails it.
  Storybook's "Run tests" button runs them too.
- `test/vitest.compat.config.ts` runs the stories again against pdf.js 6.0, the oldest
  supported version. It's a separate file because Storybook's test runner allows only one
  story project per Vitest config.
- `test/bundle/`: builds consumer apps against `dist/` through the package's `exports`, and
  checks that headless imports never reach the UI (in the bundle, and in the static import
  graph a dev server would load), that no JavaScript imports CSS, and gzip size budgets.
  Also checks the published CSS: layers, and that every selector has zero specificity.
- `scripts/build-css.ts`: builds `dist/core.css` and `dist/ui.css` from `src/css/` with
  Lightning CSS, inlining `core.css` into `ui.css` and wrapping selectors in `:where()`.
- `test/fixtures/`: PDFs generated in memory, so tests need no network or binary files.
  The "extras" fixture adds an outline, links, page labels and document info.
