// Provider and state access
export {
  PdfViewerProvider,
  usePdfViewerState,
  usePdfViewerStore,
  type PdfViewerProviderProps,
} from "./context.tsx";
export { PdfViewerStore, type StoreOptions } from "./core/store.ts";

// One hook per toolbar feature
export {
  useCursorMode,
  useDownload,
  usePageNavigation,
  usePdfDocument,
  useSearch,
  useSidebar,
  useZoom,
  type CursorModeControls,
  type Download,
  type PageNavigation,
  type PdfDocumentInfo,
  type Search,
  type SidebarControls,
  type Zoom,
} from "./hooks.ts";

// Building blocks for a custom layout
export { PdfPages, type PdfPagesProps } from "./components/PdfPages.tsx";
export { PdfSidebar, type PdfSidebarProps } from "./components/PdfSidebar.tsx";
export { PdfThumbnails, type PdfThumbnailsProps } from "./components/PdfThumbnails.tsx";

// The default UI
export { PdfViewer, type PdfViewerProps } from "./components/PdfViewer.tsx";
export { PdfToolbar, type PdfToolbarProps } from "./components/PdfToolbar.tsx";
export { PdfSearchBar, type PdfSearchBarProps } from "./components/PdfSearchBar.tsx";

export type {
  CursorMode,
  DocumentInitParameters,
  LoadStatus,
  PageSize,
  PdfSource,
  SearchMatch,
  SearchOptions,
  SearchState,
  SearchStatus,
  ViewerState,
  ZoomMode,
  ZoomPreset,
} from "./core/types.ts";
