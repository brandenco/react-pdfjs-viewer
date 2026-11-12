// `react-pdfjs-viewer`: everything. Same exports as `react-pdfjs-viewer/headless` plus
// `react-pdfjs-viewer/ui`. Production bundlers drop what you don't use either way; the
// subpaths also keep dev servers (which don't tree-shake) from loading unused UI.
export * from "./headless.ts";
export * from "./ui.ts";
