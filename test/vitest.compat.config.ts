// The stories again, against the oldest supported pdf.js, so the peer range stays honest.
// Kept out of vitest.config.ts; see `storybookProject` for why.
import { defineConfig } from "vitest/config";

import { root, storybookProject } from "./vitest.shared.ts";

export default defineConfig({
  root,
  test: {
    projects: [
      storybookProject("stories (pdf.js 6.0)", {
        alias: [{ find: /^pdfjs-dist(\/.*)?$/, replacement: "pdfjs-dist-6.0$1" }],
      }),
    ],
  },
});
