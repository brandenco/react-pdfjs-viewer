# react-pdfjs-viewer

A virtualized React PDF viewer built on [`pdfjs-dist`](https://github.com/mozilla/pdf.js).
Use the default `<PdfViewer>` or compose your own UI from the building blocks and hooks.

- **Virtualized**: only pages near the viewport are mounted. Off-screen canvases are released, and fast scroll-bys never render. Page 1 renders immediately; the other page sizes stream in afterwards without the scroll position jumping.
- **Hooks for every toolbar action**: page navigation, zoom, search, cursor mode (text select / hand drag), download, and sidebar.
- **Thumbnail sidebar**: virtualized, slides open, follows the current page, and caches rendered bitmaps in an LRU.
- **Styles stay isolated**: all CSS lives in the `rpv` cascade layer, so it never overrides your styles and any of your rules can override it.
- **SSR-safe**: pdf.js is lazy-loaded on the client.

## Usage

Peer dependencies: `react` / `react-dom` 19+ and `pdfjs-dist` 6.x (tested on 6.0 through 6.5).

```tsx
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"; // Vite; use your bundler's equivalent
import { PdfViewer } from "react-pdfjs-viewer";

<div style={{ height: 800 }}>
  <PdfViewer src="/file.pdf" workerSrc={workerSrc} />
</div>;
```

### Custom toolbar

```tsx
import {
  PdfViewerProvider,
  PdfPages,
  PdfSidebar,
  PdfThumbnails,
  usePageNavigation,
  useZoom,
  useSearch,
  useCursorMode,
  useDownload,
  useSidebar,
} from "react-pdfjs-viewer";

function Toolbar() {
  const { currentPage, numPages, nextPage, previousPage, goToPage } = usePageNavigation();
  const { scale, zoomIn, zoomOut, zoomTo } = useZoom(); // zoomTo("page-fit" | "page-width")
  const { search, next, previous, matches, activeIndex } = useSearch();
  const { mode, setMode, toggle } = useCursorMode(); // "text" | "hand"
  const { download } = useDownload();
  const sidebar = useSidebar();
  // …render whatever you like
}

<PdfViewerProvider src={src} workerSrc={workerSrc}>
  <Toolbar />
  <div style={{ display: "flex", height: 800 }}>
    <PdfSidebar>
      <PdfThumbnails />
    </PdfSidebar>
    <PdfPages style={{ flex: 1 }} />
  </div>
</PdfViewerProvider>;
```

`usePdfViewerState(selector)` and `usePdfViewerStore()` give lower-level access.

### Styling

Styles are imported for you: `styles.css` with the core viewer, and `viewer.css` only when you use the default `<PdfViewer>` / `PdfToolbar`, so headless setups never load toolbar styles. Every rule sits in `@layer rpv`, so your styles always win.
Theme it by setting `--rpv-*` tokens on the viewer or any ancestor (including `:root`):
`--rpv-background`, `--rpv-surface`, `--rpv-surface-muted`, `--rpv-surface-active`,
`--rpv-text`, `--rpv-text-muted`, `--rpv-border`, `--rpv-accent`, `--rpv-radius`,
`--rpv-page-background`, `--rpv-highlight`, `--rpv-highlight-active`, `--rpv-selection`.
The defaults follow the page's `color-scheme` through `light-dark()`. To nest the styles
inside one of your own layers, import them explicitly:

```css
@import "react-pdfjs-viewer/styles.css" layer(vendor);
@import "react-pdfjs-viewer/viewer.css" layer(vendor); /* only with <PdfViewer> */
```

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
pnpm lint:pkg       # publint + are-the-types-wrong against the packed tarball
```

Tests live in `test/`:

- `test/unit/`: Vitest unit tests for the pure logic in `src/core/` (Node, milliseconds).
- `test/stories/`: Storybook stories. Each story is also a test: Vitest renders it in
  Chromium, runs its `play` function, then runs axe; any accessibility violation fails it.
  Storybook's "Run tests" button runs them too.
- `test/vitest.compat.config.ts` runs the stories again against pdf.js 6.0, the oldest
  supported version. It's a separate file because Storybook's test runner allows only one
  story project per Vitest config.
- `test/fixtures/`: PDFs generated in memory, so tests need no network or binary files.
