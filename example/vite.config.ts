// The example app: `pnpm example` serves it, `pnpm build:example` builds it.
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { zeroSpecificity } from "../scripts/build-css.ts";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // Relative asset URLs, so the build works from any path (GitHub Pages, say).
  base: "./",
  plugins: [react()],
  // The same transform as the published CSS (every selector in :where()).
  css: {
    transformer: "lightningcss",
    lightningcss: { visitor: { Selector: zeroSpecificity } },
  },
  resolve: {
    // The examples import the package by name, exactly as an app would, but run against
    // the library's source. Most specific first: aliases match by prefix.
    alias: [
      { find: /^@brandenco\/react-pdfjs-viewer\/headless$/, replacement: source("headless.ts") },
      { find: /^@brandenco\/react-pdfjs-viewer\/ui$/, replacement: source("ui.ts") },
      {
        find: /^@brandenco\/react-pdfjs-viewer\/(core|ui)\.css$/,
        replacement: source("css/$1.css"),
      },
      { find: /^@brandenco\/react-pdfjs-viewer$/, replacement: source("index.ts") },
    ],
  },
  // pdf.js is already ESM; pre-bundling it would also break the worker's `?url` import.
  optimizeDeps: { exclude: ["pdfjs-dist"] },
  build: { outDir: "../example-dist", emptyOutDir: true },
});

function source(file: string): string {
  return fileURLToPath(new URL(`../src/${file}`, import.meta.url));
}
