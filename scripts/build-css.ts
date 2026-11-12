// Builds dist/core.css and dist/ui.css from src/css/.
//
// - ui.css's `@import "./core.css"` is inlined, so ui.css is one self-contained file.
// - Every selector is wrapped in :where(), so our rules have zero specificity: any rule
//   of the user's wins over ours, even when both are in the same cascade layer. The
//   sources stay readable; only the published files are transformed.
//
// Run directly (`node scripts/build-css.ts`) or import `buildCss` (tests do).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { bundle, type Selector, type SelectorComponent } from "lightningcss";

const root = new URL("..", import.meta.url);

function isWhere(component: SelectorComponent | undefined): boolean {
  return component?.type === "pseudo-class" && component.kind === "where";
}

/**
 * `.a .b:hover::before` → `:where(.a .b:hover)::before`. Pseudo-elements can't go inside
 * :where(), so they stay outside; a selector that ends in a combinator before one
 * (`.a ::selection`) gets a `*`, to keep meaning "any descendant".
 */
export function zeroSpecificity(selector: Selector): Selector {
  const cut = selector.findIndex((component) => component.type === "pseudo-element");
  const head = cut === -1 ? selector : selector.slice(0, cut);
  const tail = cut === -1 ? [] : selector.slice(cut);
  if (head.length === 0) return selector;

  if (head.length === 1 && isWhere(head[0])) {
    return selector; // already zero
  }
  if (tail.length > 0 && head.at(-1)?.type === "combinator") {
    head.push({ type: "universal" });
  }
  const where: SelectorComponent = { type: "pseudo-class", kind: "where", selectors: [head] };
  return [where, ...tail];
}

function build(file: string): string {
  return bundle({
    filename: fileURLToPath(new URL(`src/css/${file}`, root)),
    minify: false,
    visitor: { Selector: zeroSpecificity },
  }).code.toString();
}

/** The published CSS files, by name. */
export function buildCss(): Record<"core.css" | "ui.css", string> {
  return { "core.css": build("core.css"), "ui.css": build("ui.css") };
}

if (import.meta.main) {
  const dist = new URL("dist/", root);
  mkdirSync(dist, { recursive: true });
  for (const [name, css] of Object.entries(buildCss())) {
    writeFileSync(new URL(name, dist), css);
  }
}
