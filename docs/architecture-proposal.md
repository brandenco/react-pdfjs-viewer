# Architecture audit & proposal

Status: steps 1–6 of the implementation order are implemented. See [Implementation notes](#3-implementation-notes) for where the result differs from the proposal.

## 1. Audit

### What already meets the goals

The codebase is closer to "headless-first" than the brief assumes. Rewriting it is not justified.

| Goal                             | State today                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single source of truth           | `PdfViewerStore` (`src/core/store.ts`) holds all viewer state and actions. Every hook and component reads it. Nothing duplicates logic.                                                                                                                                                                                                                                |
| Narrow subscriptions             | `usePdfViewerState(selector)` uses `useSyncExternalStore`, so components re-render only when their slice changes. Hook action objects are memoized per store.                                                                                                                                                                                                          |
| React as integration layer       | Search (`search.ts`), layout math (`layout.ts`), zoom (`zoom.ts`), text extraction, highlights, scheduling and the thumbnail LRU are plain TS with unit tests.                                                                                                                                                                                                         |
| Default UI built on public hooks | `PdfToolbar`, `PageControls`, `ZoomControls` and the others only use the public hooks.                                                                                                                                                                                                                                                                                 |
| pdf.js handling                  | `pdfjs-dist` is a peer dependency, loaded with `import()` (SSR-safe, not in the main chunk). The worker URL is a prop.                                                                                                                                                                                                                                                 |
| CSS isolation                    | Everything sits in `@layer rpv` with `--rpv-*` tokens. Core CSS (`styles.css`) is imported by the provider. Toolbar CSS (`viewer.css`) is imported only by `ToolbarButton`.                                                                                                                                                                                            |
| Performance                      | Virtualized pages and thumbnails, deferred rendering (`renderDelay`), render-task cancellation, canvas memory release, `page.cleanup()` on unmount, page sizes streamed at background priority, search that yields to the main thread, the CSS Highlight API, a thumbnail `ImageBitmap` LRU that `close()`s evicted bitmaps, and scroll anchoring across zoom changes. |

### Tree-shaking, measured

I bundled three consumer apps against `dist/` with Vite 8 (Rolldown), with `react` and `pdfjs-dist` external and no minification. The gzip sizes are of the JS:

| Consumer                            | JS (gz) | CSS                   | Contents                                                                                             |
| ----------------------------------- | ------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| Provider + `usePageNavigation` only | 7.6 KB  | 9.8 KB (`styles.css`) | The whole store: search, text extraction, download and the thumbnail cache all come along.           |
| Provider + `PdfPages` + `useZoom`   | 14.0 KB | 9.8 KB                | Toolbar, search bar, sidebar and thumbnails are correctly dropped. `viewer.css` is correctly absent. |
| `<PdfViewer>`                       | 19.9 KB | 15.3 KB               | Everything.                                                                                          |

Conclusions:

- **Component-level shaking works in production builds.** `sideEffects: ["**/*.css"]` together with per-file ESM output from `tsc` is enough.
- **Store methods cannot be shaken.** Search, download and the text cache are class methods, so every consumer pays for them. That costs about 2–3 KB gz today. It isn't worth splitting the class now, but it should not grow.
- **Dev servers don't tree-shake.** Vite dev serves unbundled ESM, so `import … from "react-pdfjs-viewer"` executes every module in the barrel, and that includes `viewer.css`. Headless users get toolbar CSS in dev but not in prod. Subpath entry points fix this.
- **`styles.css` mixes structural page/text-layer CSS with sidebar and thumbnail CSS.** It's harmless because the rules are scoped to classes, but the sidebar is opinionated UI and its CSS belongs with the UI.

### Coupling and gaps

1. **Only `PdfPages` can drive scrolling.** `PageScroller` and `setCurrentPage` go through `storeInternals()`, which is private. A custom page renderer (for example a single-page viewer) cannot take part in navigation, search reveal or fit-zoom. `PdfPage` is not exported.
2. **Search-bar open state is local to `PdfViewer`.** A custom `toolbar` passed to `<PdfViewer>` cannot open the built-in search bar. `PdfToolbar` _requires_ `isSearchOpen` and `onSearchOpenChange`, so `<PdfViewerProvider><PdfToolbar/>…` (the composable pattern) doesn't work without wiring.
3. **The toolbar building blocks are not exported.** `PageControls`, `ZoomControls`, `CursorModeControls` and `ToolbarButton` are internal, so you can't "replace one control, keep the rest".
4. **`goToPage()` before `PdfPages` mounts is lost.** It updates `currentPage` but nothing scrolls once the scroller registers. There is no `initialPage`.
5. **No destination resolution and no annotation layer.** Links in PDFs don't work, and outline, named destinations and form fields have no foundation to build on.
6. **`workerSrc` mutates the global `GlobalWorkerOptions`.** That's acceptable, because pdf.js has one worker config per page, but it should be documented. `documentOptions.worker` / `workerPort` already pass through for advanced setups.
7. **Not supported:** rotation, print, fullscreen, outline, page labels, metadata and permissions, attachments, optional content, forms, ctrl+wheel/pinch zoom, and spread, horizontal or presentation layouts.

## 2. Proposal

### Module boundaries and entry points

```
src/
  core/        framework-free: store, pdf.js access, layout, search, text, navigation (new), print (new)
  headless/    React integration: provider, hooks, rendering primitives (PdfPages, PdfPage, PdfThumbnails)
  ui/          opinionated components: PdfViewer, PdfToolbar, controls, PdfSidebar, PdfSearchBar, PdfOutline (new)
  headless.ts  barrel → "react-pdfjs-viewer/headless"
  ui.ts        barrel → "react-pdfjs-viewer/ui"
  index.ts     re-exports both (unchanged public surface)
```

```jsonc
"exports": {
  ".":          { "types": "./dist/index.d.ts",    "import": "./dist/index.js" },
  "./headless": { "types": "./dist/headless.d.ts", "import": "./dist/headless.js" },
  "./ui":       { "types": "./dist/ui.d.ts",       "import": "./dist/ui.js" },
  "./styles.css": "./dist/styles.css",
  "./viewer.css": "./dist/viewer.css"
}
```

- **Dependency rule:** `core` ← `headless` ← `ui`. `headless` never imports `ui` or `viewer.css`. A bundle test (below) enforces it.
- The build stays `tsc`-only, with no bundler. Per-file ESM is already the most shakeable output.
- `PdfThumbnails` stays headless. It's a rendering primitive with only structural CSS. `PdfSidebar` (sliding panel) moves to `ui`, and its CSS moves into `viewer.css`.
- `PdfViewerProvider` and the `Pdf*` component names are kept. Adding `PdfProvider` or `Toolbar` aliases would just give one thing two names.

### State management

- Keep `PdfViewerStore` with `useSyncExternalStore`. It is small, fast and already selector-based, so no Zustand or other dependency is needed.
- **New rule for growth:** a new capability is a standalone module in `core/` (functions that take the store or `PDFDocumentProxy`), plus a hook in `headless/`. It is not a new class method. That keeps outline, print, attachments and the rest tree-shakeable. Only state that several features coordinate on lives in `ViewerState`: rotation, the sidebar view, search-bar open state and pending navigation.
- **Lazy per-document data:** outline, metadata, attachments and labels go in a small per-store `WeakMap<doc, Promise>` memo and are exposed through hooks with `{ status, data }`. They never sit in `ViewerState`, so unrelated components never re-render for them.

### UI state that has to be shared

- `ViewerState.isSearchOpen`, exposed by extending `useSearch()` with `isOpen`, `setOpen` and `toggleOpen`. Closing clears the search, which is today's behavior. `PdfToolbar`'s search props become optional and fall back to the store. This change is non-breaking.
- `ViewerState.sidebarView: "thumbnails" | "outline" | "attachments"`, exposed by extending `useSidebar()` with `view` and `setView`. This is also non-breaking.

### Rendering responsibilities

- **`core/navigation.ts` (new):** resolves destinations, meaning explicit arrays, named destinations and page refs, to `{ pageIndex, x, y, zoom? }`. It also provides a minimal `IPDFLinkService` implementation. This is the foundation for links, outline and forms.
- **Public scroll target.** Export a `usePageScroller()` registration hook, the current internal contract, so a custom page renderer can drive navigation. The store keeps a _pending target_ that it applies when a scroller registers, which fixes gap 4 and enables `initialPage`.
- **`PdfPage` gains an annotation layer** (pdf.js `AnnotationLayer`) rendered after the text layer, under the same abort and cancel lifecycle. Links come first, forms later, both through `annotationMode`.
- **Rotation:** store `rotation` (0/90/180/270). It feeds `page.getViewport({ rotation })` and the swapped `pageSizes` width and height, and scroll anchoring already handles the layout change.
- **Render priority:** not now. The pdf.js worker already serializes work, and `renderDelay` filters fly-bys. Revisit only if profiling a large document shows overscan pages delaying visible ones.

### Feature priorities

| P   | Capability                                                                                      | Kind                              | Why this order                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Entry points, shared UI state, exported controls                                                | infra                             | Unlocks all three consumption patterns.                                                                                                                     |
| 1   | Destination navigation, pending scroll and `initialPage`                                        | infra                             | Prerequisite for links and outline; fixes a bug.                                                                                                            |
| 1   | Annotation layer: links                                                                         | pdf.js primitive and viewer infra | Broken links are the most visible gap.                                                                                                                      |
| 1   | `useOutline` + `<PdfOutline>` (sidebar view)                                                    | pdf.js primitive                  | High value, cheap once navigation exists.                                                                                                                   |
| 2   | Rotation (`useRotation`)                                                                        | viewer infra                      | Cheap, expected.                                                                                                                                            |
| 2   | `useDocumentProperties`: info, metadata, permissions, page labels                               | pdf.js primitives, grouped        | One hook, lazy, cheap. Page labels also feed `PageControls`.                                                                                                |
| 2   | `useFullscreen(ref)`                                                                            | UI-level hook, no store           | Cheap.                                                                                                                                                      |
| 2   | `usePrint` (`core/print.ts`: render pages to images in a hidden iframe, respecting permissions) | viewer infra                      | Expected, moderate complexity.                                                                                                                              |
| 2   | Ctrl+wheel and pinch zoom, anchored at the pointer                                              | viewer infra                      | Expected interaction. Extends the scroll anchor.                                                                                                            |
| 3   | Attachments (`useAttachments` + sidebar view)                                                   | pdf.js primitive                  | Niche, cheap.                                                                                                                                               |
| 3   | Forms (AnnotationLayer forms + `annotationStorage`, save via `saveDocument`)                    | viewer infra                      | Valuable but needs storage, dirty-state and save APIs.                                                                                                      |
| 3   | Optional content (`useLayers`)                                                                  | pdf.js primitive                  | Niche. Needs re-render on config change.                                                                                                                    |
| 4   | Spread, horizontal and single-page layouts                                                      | viewer infra                      | `ListLayout` is 1-D vertical, so this generalizes virtualization and anchoring. That's the biggest structural change, so it comes after the rest is stable. |
| 4   | Presentation mode                                                                               | composite                         | Fullscreen + single-page layout.                                                                                                                            |

### Backward compatibility

- Every current export stays available from `"react-pdfjs-viewer"`, with the same names and signatures.
- Only additive changes: optional `PdfToolbar` props, extended hook return objects, new subpaths.
- `styles.css` and `viewer.css` keep their names. The sidebar rules move from the first to the second. Someone using `PdfSidebar` already pulls in `viewer.css` automatically once it imports it. Someone `@import`-ing `styles.css` manually with a hand-built sidebar needs to add `viewer.css`, which goes in a changelog note.

### Verification

- **`test/bundle/` (new):** builds consumer apps with Vite's API against `dist/`, as I did for this audit, and asserts the following:
  - `/headless` output contains no `rpv-toolbar`, `PdfToolbar` or `viewer.css`.
  - A hooks-only consumer contains no `PdfPages`.
  - `<PdfViewer>` stays under a gz size budget.
- `lint:pkg` (publint + attw) covers the new subpaths.
- Unit tests for `core/navigation.ts` and print page selection. Stories for outline, links, rotation and the composable `<PdfToolbar/>` without props.

### Implementation order (Phase 3)

1. Create the `headless/` and `ui/` folders, barrels, `exports` and the CSS move, plus the bundle test.
2. Shared UI state (`isSearchOpen`, `sidebarView`). Make `PdfToolbar` props optional and export the controls.
3. `core/navigation.ts`, pending scroll target, `initialPage`, public `usePageScroller`.
4. Annotation layer (links), outline and the sidebar view switcher.
5. Rotation, document properties and page labels, fullscreen, print, wheel/pinch zoom.
6. Docs (Phase 4): README sections for each consumption pattern, worker setup, imports and tree-shaking, and raw pdf.js access via `usePdfDocument().document`.

## 3. Implementation notes

Steps 1–6 are done. These are the places where the implementation differs from the proposal, and what remains.

**Differences from the proposal**

- **Scroller registration.** It's a set of store methods (`attachScroller`, `reportCurrentPage`, `reportViewportResize`), not a `usePageScroller` hook. A hook would only wrap one call, and the store methods also work outside React.
- **Pending targets live in two places.** Navigation can arrive before `PdfPages` mounts (the store keeps the target) or before the layout includes the page (the scroll anchor keeps it). The scroll anchor also remembers the page the user jumped to, until they scroll themselves, so a target near the bottom of a page doesn't immediately report the next page.
- **UI building blocks that weren't planned.** `PdfViewerShell` and `PdfViewerBody` provide the frame, Cmd/Ctrl+F, and `aria-controls` wiring for hand-assembled viewers. Each toolbar button is its own export.
- **Renames.** The cursor mode component is exported as `CursorModeSwitch`, because `CursorModeControls` is already the name of `useCursorMode()`'s return type. The toolbar's sidebar button is labelled "Sidebar" instead of "Thumbnails".
- **Permissions have their own loader**, separate from the rest of the properties, so printing doesn't bundle metadata parsing.
- **The annotation layer renders links only.** Popups and form widgets need UI and styles this viewer doesn't have yet. Their appearance is still drawn on the canvas.

**Styling, revised after the first implementation.** The CSS no longer loads as a side effect of importing components. Apps import `core.css` (what's needed to work) or `ui.css` (core plus the default look) themselves, and can place it in their own cascade layer. A build step (`scripts/build-css.ts`) wraps every selector in `:where()` so ours never outweighs theirs. Every UI component takes `className` and `style`, and the README lists the class names and state attributes that are public API. The reason: CSS imported by JS gets declared after the app's own layers, so it beat Tailwind's utilities, and it couldn't be skipped or relocated.

**Size, minified and gzipped JS** (enforced as budgets in `test/bundle/`):

| Consumer              | Before  | After   |
| --------------------- | ------- | ------- |
| Provider + one hook   | 4.5 kB  | 5.5 kB  |
| Provider + `PdfPages` | 8.6 kB  | 11.0 kB |
| `<PdfViewer>`         | 12.5 kB | 19.1 kB |

**Not done yet**, in priority order: attachments, interactive forms, optional content, then spread, horizontal and single-page layouts, and presentation mode (P3–P4 in the table above).

**Known issue, pre-existing:** with mixed page sizes in a viewport narrower than the widest page, the list scrolls horizontally from the left edge, so narrower pages look off-center at first.
