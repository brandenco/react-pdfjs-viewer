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

| Import                        | What's in it                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-pdfjs-viewer/headless` | The provider, the store, every hook, and the rendering primitives `PdfPages` and `PdfThumbnails`. Loads only `styles.css` (layout of pages, text and link layers, thumbnails). |
| `react-pdfjs-viewer/ui`       | The opinionated components: `PdfViewer`, `PdfToolbar` and its buttons, `PdfSidebar`, `PdfOutline`, `PdfSearchBar`, the shell. Each loads `viewer.css`.                         |
| `react-pdfjs-viewer`          | Both of the above.                                                                                                                                                             |

Production bundlers drop whatever you don't use, from any entry point. The subpaths also
keep **dev servers**, which don't tree-shake, from loading UI code and CSS you don't use,
so prefer them. Sizes, minified and gzipped, without pdf.js (a lazily loaded peer
dependency), as checked by `pnpm test:bundle`:

| You use                   | JS      |
| ------------------------- | ------- |
| The provider and one hook | 5.5 kB  |
| `PdfPages` and a hook     | 10.9 kB |
| `<PdfViewer>`             | 18.3 kB |

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
`react-pdfjs-viewer/ui`, nor its CSS, ends up in your bundle.

```tsx
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

`styles.css` (the headless layout) is imported by the provider, and `viewer.css` (the
toolbar, sidebar, outline and search bar) only by the UI components, so headless setups
never load the latter. Every rule sits in `@layer rpv`, so your styles always win.
Theme it by setting `--rpv-*` tokens on the viewer or any ancestor (including `:root`):
`--rpv-background`, `--rpv-surface`, `--rpv-surface-muted`, `--rpv-surface-active`,
`--rpv-text`, `--rpv-text-muted`, `--rpv-border`, `--rpv-accent`, `--rpv-radius`,
`--rpv-page-background`, `--rpv-highlight`, `--rpv-highlight-active`, `--rpv-selection`.
The defaults follow the page's `color-scheme` through `light-dark()`. To nest the styles
inside one of your own layers, import them explicitly:

```css
@import "react-pdfjs-viewer/styles.css" layer(vendor);
@import "react-pdfjs-viewer/viewer.css" layer(vendor); /* only with the UI components */
```

## Upgrading from earlier versions

Everything previously exported from `react-pdfjs-viewer` still is, with the same names.
The changes to be aware of:

- `PdfToolbar`'s `isSearchOpen` / `onSearchOpenChange` props are now optional: without
  them it uses the shared `useSearch().isOpen`. `PdfSearchBar`'s `onClose` is optional the
  same way (without it, the bar shows itself while `isOpen`).
- The sidebar's styles moved from `styles.css` to `viewer.css`. `PdfSidebar` imports
  `viewer.css` itself; only setups that `@import` the CSS by hand need to add it.
- The toolbar's sidebar button is now labelled "Sidebar" (it was "Thumbnails"), since
  the sidebar can show the outline too. Tests that find it by name need updating.
- The default toolbar has new buttons (rotate, full screen, print), and `PdfPages`
  renders a link layer; `annotations={false}` turns it off.

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
  checks that headless imports never reach the UI or `viewer.css` (in the bundle, and in
  the static import graph a dev server would load), plus gzip size budgets.
- `test/fixtures/`: PDFs generated in memory, so tests need no network or binary files.
  The "extras" fixture adds an outline, links, page labels and document info.
