# react-pdfjs-viewer

[![npm](https://img.shields.io/npm/v/@brandenco/react-pdfjs-viewer)](https://www.npmjs.com/package/@brandenco/react-pdfjs-viewer)

A virtualized React PDF viewer built on [`pdfjs-dist`](https://github.com/mozilla/pdf.js).
Drop in the full viewer, rebuild it from its parts, or skip the UI entirely and use the
hooks. All three run on the same engine.

1. **Complete viewer**: `<PdfViewer src="…" />`, with a toolbar, sidebar and search.
2. **Composable**: the same toolbar, buttons, sidebar, outline and search bar, arranged
   your way.
3. **Headless**: hooks and rendering primitives. None of the UI or its CSS ends up in
   your bundle.

## Features

- **Virtualized.** Only pages near the viewport are mounted. Off-screen canvases are
  released, and pages you scroll past quickly never render. Page 1 appears right away,
  and the rest of the page sizes load in afterwards without moving your scroll position.
- **Navigation.** Page numbers and page labels ("iv", "A-1"), internal and external
  links, the document outline, and named destinations.
- **Zoom.** Zoom steps, fit page, fit width, and Ctrl/⌘ + wheel or trackpad pinch that
  zooms around the pointer.
- **Search.** Results stream in on large documents and are highlighted with the CSS
  Custom Highlight API. It matches text however it's encoded, including ligatures ("ﬁ"),
  full-width letters, words hyphenated across lines, and optionally accents.
- **Isolated styles.** All CSS lives in the `rpv` cascade layer, so it never overrides
  your styles, and any rule you write overrides it.
- **SSR-safe.** pdf.js is only loaded on the client.

Also included: rotation, printing, full screen, download, a text selection / hand tool,
virtualized thumbnails, and document properties and permissions.

## Getting started

You'll need `react` and `react-dom` 19+ and `pdfjs-dist` 6.x (tested on 6.0 through 6.5).

```sh
npm install @brandenco/react-pdfjs-viewer pdfjs-dist
```

```tsx
import { PdfViewer } from "@brandenco/react-pdfjs-viewer/ui";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"; // see "pdf.js worker" below

import "@brandenco/react-pdfjs-viewer/ui.css"; // once, anywhere in your app; see "Styling"

<div style={{ height: 800 }}>
  <PdfViewer src="/file.pdf" workerSrc={workerSrc} />
</div>;
```

The viewer fills its container, so give the container a height.

`src` accepts a URL string, a `URL`, or the file's bytes (`Uint8Array` or `ArrayBuffer`).
Other props set the starting zoom, page and sidebar state and the download filename,
pass options through to pdf.js' `getDocument()` (passwords, cMaps, HTTP headers), and add
`onDocumentLoad` and `onError` callbacks. [`CompleteViewer.tsx`](example/src/examples/CompleteViewer.tsx)
shows them all.

### pdf.js worker

pdf.js parses documents in a web worker, and your bundler has to serve the worker
script. Pass its URL as `workerSrc`:

```tsx
// Vite
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
// webpack 5, Next.js, Rspack, Parcel
const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
// Or a copy you host yourself (it must match your pdfjs-dist version)
const workerSrc = "/pdf.worker.min.mjs";
```

`workerSrc` sets pdf.js' global `GlobalWorkerOptions.workerSrc`, so if you already set
that yourself, you can leave it out. To share one worker across several documents, pass
a `PDFWorker` as `documentOptions={{ worker }}`.

## Examples

The [example app](example/) has one file per use case. Run it with `pnpm example` (see
[Development](#development)). It opens a generated sample document, and you can open
your own PDF from there.

| Example                                                    | Shows                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Complete viewer](example/src/examples/CompleteViewer.tsx) | `<PdfViewer>` and its props.                                                        |
| [Composed viewer](example/src/examples/ComposedViewer.tsx) | `<PdfViewer>` assembled by hand from its pieces, with a sidebar of your own.        |
| [Custom toolbar](example/src/examples/CustomToolbar.tsx)   | Your own toolbar from the built-in parts and `ToolbarButton`.                       |
| [Headless](example/src/examples/Headless.tsx)              | Hooks and rendering primitives only, with your own UI.                              |
| [Custom controls](example/src/examples/CustomControls.tsx) | `usePageField`, `useSearchField` and `useFindShortcut` on your own inputs.          |
| [Page overlay](example/src/examples/PageOverlay.tsx)       | Drawing bounding boxes with your own cursor mode and page layer.                    |
| [Document data](example/src/examples/DocumentData.tsx)     | Properties and permissions, your own document data, an outline tree, and the store. |

## Entry points

| Import                                   | What's in it                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@brandenco/react-pdfjs-viewer/headless` | The provider, the store, every hook, and the rendering primitives `PdfPages` and `PdfThumbnails`.                             |
| `@brandenco/react-pdfjs-viewer/ui`       | The opinionated components: `PdfViewer`, `PdfToolbar` and its buttons, `PdfSidebar`, `PdfOutline`, `PdfSearchBar`, the shell. |
| `@brandenco/react-pdfjs-viewer`          | Both of the above.                                                                                                            |
| `@brandenco/react-pdfjs-viewer/core.css` | The styles the viewer needs to work.                                                                                          |
| `@brandenco/react-pdfjs-viewer/ui.css`   | `core.css` plus the default look.                                                                                             |

None of the JavaScript imports CSS. You import one of the two stylesheets yourself (see
[Styling](#styling)).

Production bundlers drop any JavaScript you don't use, whichever entry point you import
from. Dev servers don't tree-shake, though, so prefer the `/headless` and `/ui` subpaths
to keep them from loading UI code you aren't using.

Here's how much JavaScript loads up front, minified and gzipped (checked by
`pnpm test:bundle`). pdf.js, a peer dependency, and the search code load the first time
they're needed.

| You use                   | JS      |
| ------------------------- | ------- |
| The provider and one hook | 5.4 kB  |
| `PdfPages` and a hook     | 12.7 kB |
| `<PdfViewer>`             | 22.4 kB |

## Composing your own viewer

Everything inside `<PdfViewer>` is exported, so you can put it together yourself and
change what you need: `PdfViewerProvider`, `PdfViewerShell`, `PdfToolbar`,
`PdfViewerBody`, `PdfSidebar`, `PdfThumbnails`, `PdfPages` and `PdfSearchBar`. See
[`ComposedViewer.tsx`](example/src/examples/ComposedViewer.tsx).

You don't need to wire anything together with props. The pieces share state through the
provider, so the toolbar's search button opens the search bar on its own.
`PdfViewerShell` adds the frame and the Cmd/Ctrl+F shortcut, and links the toolbar to the
sidebar and search bar with `aria-controls`. The pieces still work without it; lay them
out with your own CSS.

### Replacing the toolbar

Pass your own to `<PdfViewer toolbar={…}>`, or build one from the parts the default
toolbar uses:

- `SidebarToggleButton`, `PageControls`, `ZoomControls`, `CursorModeSwitch`,
  `SearchToggleButton`
- `RotateButton`, `FullscreenButton`, `PrintButton`, `DownloadButton`
- `MoreActionsMenu`, which puts rotate, full screen, print and download in a menu. The
  default toolbar switches to it below 760px wide.
- `ToolbarButton`, for buttons of your own

They're all built on the public hooks. See
[`CustomToolbar.tsx`](example/src/examples/CustomToolbar.tsx).

### Sidebar views

`<PdfViewer>` shows thumbnails, and an outline tab for documents that have one. In your
own sidebar, render `<PdfThumbnails>` or `<PdfOutline>` based on `useSidebar().view`, and
use `<PdfSidebarViewSwitch>` to switch between them.
[`ComposedViewer.tsx`](example/src/examples/ComposedViewer.tsx) does this too.

## Headless

You can build any interface on the hooks. Use them inside `<PdfViewerProvider>`, and
render the pages with `<PdfPages>` (or [your own renderer](#your-own-page-renderer)).
Nothing from `/ui` ends up in your bundle. Import `core.css` for page layout, text
selection and search highlights, and style the rest yourself. See
[`Headless.tsx`](example/src/examples/Headless.tsx).

Each hook only subscribes to the state it returns, so your component re-renders only
when that state changes. Actions like `goToPage` and `zoomIn` keep the same identity
across renders, so they're safe to pass to `onClick` or list as effect dependencies.

| Hook                      | Returns                                                                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePageNavigation()`     | `currentPage`, `numPages`, `canGoPrevious`, `canGoNext`, `goToPage(n)`, `nextPage`, `previousPage`, `firstPage`, `lastPage`, `goToDestination(dest)`                                                                                           |
| `useZoom()`               | `scale`, `mode`, `minScale`, `maxScale`, `canZoomIn`, `canZoomOut`, `setScale`, `zoomIn`, `zoomOut`, `zoomTo("page-fit" \| "page-width")`                                                                                                      |
| `useSearch()`             | `query`, `options`, `status`, `matches`, `activeIndex`, `pagesSearched`, `search(query, { caseSensitive, wholeWord, matchDiacritics })`, `next`, `previous`, `setActiveMatch`, `clear`, and the search bar's `isOpen`, `setOpen`, `toggleOpen` |
| `useRotation()`           | `rotation`, `setRotation(degrees)`, `rotateClockwise`, `rotateCounterClockwise`                                                                                                                                                                |
| `useCursorMode()`         | `mode` (`"text"` \| `"hand"` \| your own), `setMode`, `toggle`                                                                                                                                                                                 |
| `useSidebar()`            | `isOpen`, `setOpen`, `toggle`, `view` (`"thumbnails"` \| `"outline"`), `setView`                                                                                                                                                               |
| `useDownload()`           | `download(filename?)`, `canDownload`, `isDownloading`                                                                                                                                                                                          |
| `usePrint()`              | `print({ dpi })`, `cancel`, `canPrint`, `isPrinting`, `progress`                                                                                                                                                                               |
| `useFullscreen(ref)`      | `isFullscreen`, `isSupported`, `enter`, `exit`, `toggle`, for the element in `ref`                                                                                                                                                             |
| `useOutline()`            | `status`, `items` (nested), `goToItem(item)`                                                                                                                                                                                                   |
| `usePageLabels()`         | `labels`, `labelOf(pageNumber)`, `pageNumberOf(label)`                                                                                                                                                                                         |
| `useDocumentProperties()` | `{ status, data }`: title, author, subject, dates, producer, `permissions`, `pageLabels`, raw `info` and XMP `metadata`                                                                                                                        |
| `usePdfDocument()`        | `status`, `error`, `numPages`, and the pdf.js `document`                                                                                                                                                                                       |

The outline, page labels, properties and permissions are read from the document the
first time something asks for them. That happens once per document, and every
component shares the result.

### Building your own controls

The default UI's interaction logic is also available as hooks. They return props you
spread onto your own elements, so your controls behave the same way the built-in ones
do:

- `usePageField()` for a page number input. It handles page labels, typing, Enter and
  Escape, and IME input.
- `useSearchField()` for a search input: search as you type, Enter / Shift+Enter to
  step through results, Escape to close.
- `useFindShortcut(ref)` makes Cmd/Ctrl+F open your search instead of the browser's.

`useSearchField` also gives you `spokenCountLabel` ("Result 3 of 12") and `announcement`
for an `aria-live` region. The announcement is filled in once the search finishes and
the user has stopped typing for `announceDelay` (500 ms by default).

For a custom outline tree, `useOutlineEntry(outline, item)` gives each entry its expanded
state, whether it's the current entry (or a collapsed parent of it), and a `select()`
function.

See [`CustomControls.tsx`](example/src/examples/CustomControls.tsx).

### Rendering primitives

`<PdfPages>` is the scrollable, virtualized page list: the canvas, selectable text,
search highlights and clickable links. `<PdfThumbnails>` is the virtualized thumbnail
list. Both only style their layout, and both take `className` and `style`.

`<PdfPages>` props:

| Prop                               | What it does                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `gap`                              | Space between and around pages, in px. Default 16.                                                                           |
| `overscan`                         | How far past the viewport to render pages, as a fraction of its height. Default 0.5.                                         |
| `renderDelay`                      | How long a page has to stay in view before it renders, in ms. Default 60.                                                    |
| `zoomRenderDelay`                  | How long to wait after a zoom step before re-rendering at the new scale, in ms. Default 400.                                 |
| `maxCanvasPixels`                  | Maximum pixels per page canvas (default 4096 × 4096). Past it, the visible part is redrawn at full resolution to stay sharp. |
| `annotations`                      | `false` skips the link layer.                                                                                                |
| `externalLinkTarget`               | Where external links open. Default `"_blank"`.                                                                               |
| `loadingFallback`, `errorFallback` | What to show while loading or after an error.                                                                                |
| `renderPageOverlay`                | Your own layer on each page. See below.                                                                                      |

### Page overlays and custom cursor modes

`renderPageOverlay` renders a layer of your own on every mounted page, above the canvas,
text and links. Use it for bounding boxes, highlights, or a drawing surface.

The overlay gets a box the size of the page that follows zoom and rotation, plus helpers
to convert between PDF coordinates and screen pixels: `toViewportRect`, `toPdfRect`,
`toViewportPoint` and `toPdfPoint`. Store your positions in PDF units and they'll stay
correct through zooming and rotating.

The overlay ignores pointer events, so text selection and links keep working beneath
it. Set `pointer-events: auto` on anything that should take input. The hand tool never
pans when you drag inside an overlay.

`setMode` accepts any string, so your app can add its own cursor mode, such as
`"draw"`. The viewer doesn't give it any behavior. It just sets `data-cursor="draw"` on
the page list so you can style it, and your overlay handles the input.

A couple of things to know:

- Pass a stable function (wrap it in `useCallback`), since the pages are memoized.
- The viewer's hooks work inside overlays.

[`PageOverlay.tsx`](example/src/examples/PageOverlay.tsx) draws boxes that follow zoom
and rotation.

### Printing and permissions

pdf.js doesn't enforce a document's permissions, but this library does respect the
print permission. If a document disallows printing, `usePrint().canPrint` is `false` and
`print()` rejects with an error, unless you call `print({ ignorePermissions: true })`. The other
permissions are reported by `useDocumentProperties()`, and it's up to you to act on
them.

## Advanced: pdf.js and the store

### Using pdf.js directly

`usePdfDocument().document` is the pdf.js `PDFDocumentProxy`. Use it for anything this
library doesn't wrap, like `getPage`, `getAttachments` or `saveDocument`.

### Your own document data

`useDocumentData(load)` runs `load(document)` once per document and shares the result,
the same way `useOutline` does. Define `load` at module level, because the function
itself is the cache key. [`DocumentData.tsx`](example/src/examples/DocumentData.tsx)
shows this, and also uses the store directly.

### Reading state outside the hooks

`usePdfViewerState(selector)` subscribes to any slice of `ViewerState`. The selector has
to return existing values rather than build new objects.

`usePdfViewerStore()` returns the `PdfViewerStore` itself. Every action is a method on
it, for example `store.goToPage(5)` and `store.setRotation(90)`, along with
`store.getState()` and `store.subscribe()`.

### Your own page renderer

Navigation, search and fit-to-page zoom all scroll through a `PageScroller`.
`<PdfPages>` registers one. If you write your own renderer, such as a single-page view:

1. Implement `PageScroller` and register it with `store.attachScroller(scroller)`.
2. Call `store.reportCurrentPage(n)` as the user scrolls.
3. Call `store.reportViewportResize()` when the viewport resizes.

## Styling

Import one stylesheet, once, in your app's entry point or a global CSS file:

| Stylesheet                               | Use it when                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `@brandenco/react-pdfjs-viewer/ui.css`   | You use the UI components and want the default look. Includes `core.css`.                   |
| `@brandenco/react-pdfjs-viewer/core.css` | You style everything yourself, either headless or restyling the UI components from scratch. |

`core.css` contains only what the viewer needs to work: page layout for virtualization,
the selectable text and link layers, search highlights, and the thumbnail list's layout.
If you import neither file, `<PdfPages>` logs a warning.

### Overriding the styles

Every rule is in a cascade layer (`rpv.core` and `rpv.ui`), and every selector is wrapped
in `:where()`, so it has zero specificity. That means your styles win:

- Plain CSS outside any layer always beats ours, whatever its specificity.
- If your CSS is in layers, put ours below yours. With Tailwind v4, for example, import
  ours into its `components` layer so utility classes override it:

  ```css
  @import "tailwindcss";
  @import "@brandenco/react-pdfjs-viewer/ui.css" layer(components);
  ```

- Even in the same layer, any selector you write beats our zero-specificity rules.

### Theming

Set the `--rpv-*` custom properties on the viewer or any ancestor, including `:root`.
The defaults use `light-dark()`, so they follow the page's `color-scheme`.

| Token                                                                    | Controls                        |
| ------------------------------------------------------------------------ | ------------------------------- |
| `--rpv-background`                                                       | Behind the pages                |
| `--rpv-surface`, `--rpv-surface-muted`, `--rpv-surface-active`           | Toolbar, sidebar, button states |
| `--rpv-text`, `--rpv-text-muted`                                         | Text colors                     |
| `--rpv-border`, `--rpv-accent`, `--rpv-radius`                           | Borders, accent color, rounding |
| `--rpv-duration`                                                         | Transition length               |
| `--rpv-page-background`, `--rpv-page-shadow`                             | The pages themselves            |
| `--rpv-highlight`, `--rpv-highlight-active`, `--rpv-highlight-underline` | Search highlights (`core.css`)  |
| `--rpv-selection`                                                        | Text selection (`core.css`)     |

### `className` and `style`

Every component accepts both on its root element. Your class is added alongside ours
rather than replacing it. That means style helpers that return both work directly, like
StyleX: `<PdfToolbar {...stylex.props(styles.toolbar)} />`.

### Stable selectors

These class names and state attributes are public API and stay stable across minor
versions. Anything else in the markup might change.

| Element                                 | Class                                        | State                                            |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| Viewer frame (`PdfViewerShell`)         | `rpv-viewer`                                 |                                                  |
| Row under the toolbar (`PdfViewerBody`) | `rpv-viewer-body`                            |                                                  |
| Page list (`PdfPages`)                  | `rpv-pages`                                  | `data-cursor="<mode>"`, `data-dragging`          |
| One page                                | `rpv-page`                                   | `data-page-number`                               |
| Your overlay on a page                  | `rpv-page-overlay`                           |                                                  |
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

Node 26 LTS and pnpm 12 are pinned in `mise.toml`. If you have
[mise](https://mise.jdx.dev) installed:

```sh
mise install        # installs the pinned Node and pnpm
mise run setup      # pnpm install + Chromium for the browser tests
```

mise also adds `node_modules/.bin` to your PATH, so you can run `oxlint`, `vitest` and
other tools without `pnpm exec`.

Without mise, use pnpm 12 (pinned in `packageManager`). It downloads the pinned Node
version (`devEngines.runtime`) for scripts automatically.

```sh
pnpm install
pnpm exec playwright install chromium   # once, for browser tests
pnpm example        # the example app on http://localhost:5173
pnpm build:example  # builds it into example-dist/
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

The example app in `example/` is a Vite app that imports the package by name, the same
way your app would, but runs against `src/`.

### Tests

- `test/unit/` has Vitest unit tests for `src/core/`. They run in Node, using pdf.js'
  Node build for tests that read real documents.
- `test/stories/` has the Storybook stories. Every story is also a test: Vitest renders
  it in Chromium, runs its `play` function, then runs axe, and any accessibility
  violation fails the test. Storybook's "Run tests" button runs them too.
- `test/vitest.compat.config.ts` runs the stories again against pdf.js 6.0, the oldest
  supported version. It's a separate config because Storybook's test runner only allows
  one story project per Vitest config.
- `test/bundle/` builds small consumer apps against `dist/` through the package's
  `exports`. It checks that headless imports never pull in the UI (both in the final
  bundle and in the import graph a dev server would load), that no JavaScript imports
  CSS, and that bundles stay within their gzip size budgets. It also checks the
  published CSS: that rules are layered and every selector has zero specificity.
- `test/fixtures/` generates PDFs in memory, so tests don't need network access or
  binary files. The "extras" fixture adds an outline, links, page labels and document
  info.

`scripts/build-css.ts` builds `dist/core.css` and `dist/ui.css` from `src/css/` with
Lightning CSS. It inlines `core.css` into `ui.css` and wraps every selector in
`:where()`.
