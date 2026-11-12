// `react-pdfjs-viewer/headless`: the viewer engine, its hooks, and the rendering
// primitives. Nothing here imports the opinionated UI. Styles are imported by the app
// (react-pdfjs-viewer/core.css or ui.css), never by these modules.

// Provider and state access
export {
  PdfViewerProvider,
  usePdfViewerState,
  usePdfViewerStore,
  type PdfViewerProviderProps,
} from "./headless/context.tsx";
export { PdfViewerStore, type PageScroller, type StoreOptions } from "./core/store.ts";
export type { PagePosition, PageTarget, PdfDestination } from "./core/navigation.ts";

// One hook per viewer feature
export {
  useCursorMode,
  useDownload,
  usePageNavigation,
  usePdfDocument,
  useRotation,
  useSearch,
  useSidebar,
  useZoom,
  type CursorModeControls,
  type Download,
  type PageNavigation,
  type PdfDocumentInfo,
  type RotationControls,
  type Search,
  type SidebarControls,
  type Zoom,
} from "./headless/hooks.ts";

// Document data, read on demand
export {
  useOutline,
  useOutlineEntry,
  type Outline,
  type OutlineEntry,
} from "./headless/use-outline.ts";
export {
  useDocumentData,
  type DocumentData,
  type DocumentDataStatus,
} from "./headless/use-document-data.ts";
export type { OutlineItem } from "./core/outline.ts";
export { useDocumentProperties } from "./headless/use-document-properties.ts";
export { usePageLabels, type PageLabels } from "./headless/use-page-labels.ts";
export type { DocumentProperties } from "./core/properties.ts";
export type { DocumentPermissions } from "./core/permissions.ts";

// Interaction logic for building your own controls: spread the returned props
export {
  usePageField,
  type PageField,
  type PageFieldInputProps,
} from "./headless/use-page-field.ts";
export {
  useSearchField,
  type SearchField,
  type SearchFieldInputProps,
  type SearchFieldOptions,
} from "./headless/use-search-field.ts";
export { useFindShortcut } from "./headless/use-find-shortcut.ts";

// Browser integration
export { useFullscreen, type Fullscreen } from "./headless/use-fullscreen.ts";
export { usePrint, type Print, type PrintProgress } from "./headless/use-print.ts";

// Rendering primitives
export { PdfPages, type PdfPagesProps } from "./headless/PdfPages.tsx";
export { PdfThumbnails, type PdfThumbnailsProps } from "./headless/PdfThumbnails.tsx";

export type {
  CursorMode,
  DocumentInitParameters,
  LoadStatus,
  PageSize,
  PdfSource,
  Rotation,
  SearchMatch,
  SearchOptions,
  SearchState,
  SearchStatus,
  SidebarView,
  ViewerState,
  ZoomMode,
  ZoomPreset,
} from "./core/types.ts";
