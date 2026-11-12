// `react-pdfjs-viewer/ui`: the opinionated components. They're built only on the public
// hooks from `react-pdfjs-viewer/headless`, and must be rendered inside a
// `<PdfViewerProvider>` (except `<PdfViewer>`, which renders its own).

// The complete viewer
export { PdfViewer, type PdfViewerProps } from "./ui/PdfViewer.tsx";

// Composable pieces
export {
  PdfViewerBody,
  PdfViewerShell,
  type PdfViewerBodyProps,
  type PdfViewerShellProps,
} from "./ui/PdfViewerShell.tsx";
export { PdfToolbar, type PdfToolbarProps } from "./ui/PdfToolbar.tsx";
export { PdfSearchBar, type PdfSearchBarProps } from "./ui/PdfSearchBar.tsx";
export { PdfSidebar, type PdfSidebarProps } from "./ui/PdfSidebar.tsx";
export {
  PdfSidebarViewSwitch,
  type PdfSidebarViewSwitchProps,
} from "./ui/PdfSidebarViewSwitch.tsx";
export { PdfOutline, type PdfOutlineProps } from "./ui/PdfOutline.tsx";

// Toolbar controls, to rearrange or replace individually
export { PageControls } from "./ui/PageControls.tsx";
export { ZoomControls } from "./ui/ZoomControls.tsx";
export { CursorModeSwitch } from "./ui/CursorModeSwitch.tsx";
export { ToolbarButton, type ToolbarButtonProps } from "./ui/ToolbarButton.tsx";
export type { StyleProps } from "./ui/class-names.ts";
export { MoreActionsMenu } from "./ui/MoreActionsMenu.tsx";
export {
  DownloadButton,
  FullscreenButton,
  PrintButton,
  RotateButton,
  SearchToggleButton,
  SidebarToggleButton,
  type FullscreenButtonProps,
  type SearchToggleButtonProps,
  type SidebarToggleButtonProps,
} from "./ui/ToolbarButtons.tsx";
