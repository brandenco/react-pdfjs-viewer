import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import type { TestProjectInlineConfiguration } from "vitest/config";

/** The repository root. Vitest config files live in test/, but paths resolve from here. */
export const root: string = fileURLToPath(new URL("..", import.meta.url));

const storybookConfigDir = fileURLToPath(new URL(".storybook", import.meta.url));

/**
 * Runs every story (its play function, then axe) in headless Chromium.
 *
 * Storybook's "Run tests" button renames story projects to `storybook:<config dir>`, so
 * a single Vitest config may only contain one of these. That's why the pdf.js 6.0 run
 * lives in its own config file (vitest.compat.config.ts).
 */
export function storybookProject(
  name: string,
  resolve: TestProjectInlineConfiguration["resolve"] = {},
): TestProjectInlineConfiguration {
  return {
    extends: true,
    plugins: [storybookTest({ configDir: storybookConfigDir, storybookScript: "pnpm storybook" })],
    resolve,
    // pdf.js is already ESM. Pre-bundling it would also turn the worker's `?url` import
    // into JavaScript, and a shared cache would mix up the two pdf.js versions.
    optimizeDeps: { exclude: ["pdfjs-dist", "pdfjs-dist-6.0"] },
    cacheDir: `node_modules/.vite/${name.replace(/\W+/g, "-")}`,
    test: {
      name,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        viewport: { width: 1280, height: 900 },
      },
    },
  };
}
