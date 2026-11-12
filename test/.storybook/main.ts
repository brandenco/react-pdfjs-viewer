import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: { disableTelemetry: true },

  viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      resolve: {
        // Stories import the package by name, but run against the library's source.
        // Most specific first: aliases match by prefix.
        alias: [
          { find: /^react-pdfjs-viewer\/headless$/, replacement: source("headless.ts") },
          { find: /^react-pdfjs-viewer\/ui$/, replacement: source("ui.ts") },
          { find: /^react-pdfjs-viewer\/(core|ui)\.css$/, replacement: source("css/$1.css") },
          { find: /^react-pdfjs-viewer$/, replacement: source("index.ts") },
        ],
      },
    });
  },
};

function source(file: string): string {
  return fileURLToPath(new URL(`../../src/${file}`, import.meta.url));
}

export default config;
