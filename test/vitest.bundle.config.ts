// Consumer bundle builds against dist/. Separate from vitest.config.ts because it needs
// a fresh `pnpm build` first; `pnpm test:bundle` runs both.
import { defineConfig } from "vitest/config";

import { root } from "./vitest.shared.ts";

export default defineConfig({
  root,
  test: {
    name: "bundle",
    include: ["test/bundle/**/*.test.ts"],
    environment: "node",
  },
});
