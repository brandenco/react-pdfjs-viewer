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
        alias: {
          "react-pdfjs-viewer": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
        },
      },
    });
  },
};

export default config;
