// Unit tests and stories. Storybook's "Run tests" button also uses this file.
import { defineConfig } from "vitest/config";

import { root, storybookProject } from "./vitest.shared.ts";

export default defineConfig({
  root,
  test: {
    // Only collected with `pnpm test:coverage` (--coverage).
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Entry points that only re-export, type declarations and CSS have no code to run.
      exclude: ["src/index.ts", "src/headless.ts", "src/ui.ts", "src/core/types.ts", "src/css/**"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
        // The library imports pdf.js' browser build; its legacy build is the one for Node.
        resolve: {
          alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }],
        },
      },
      storybookProject("stories"),
    ],
  },
});
