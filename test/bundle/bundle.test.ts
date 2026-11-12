// Builds small consumer apps against the published `dist/` (through the package's
// `exports` map) and checks what ends up in their bundles: that headless imports never
// pull in the opinionated UI, that no JS imports any CSS (users import it themselves),
// and that unused primitives are dropped. Also checks the published CSS files.
// Run with `pnpm test:bundle`, which builds the package first.
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

import { transform } from "lightningcss";
import { build, type Rolldown } from "vite";
import { describe, expect, test } from "vitest";

const root = new URL("../../", import.meta.url);

/** One alias per `exports` entry, so consumers resolve exactly what npm users would get. */
function packageAliases(): { find: RegExp; replacement: string }[] {
  const pkg: { name: string; exports: Record<string, string | { import: string }> } = JSON.parse(
    readFileSync(new URL("package.json", root), "utf8"),
  );
  return Object.entries(pkg.exports).map(([subpath, target]) => {
    const file = typeof target === "string" ? target : target.import;
    const specifier = pkg.name + subpath.slice(1); // "./ui" → "react-pdfjs-viewer/ui"
    return {
      find: new RegExp(`^${specifier.replaceAll(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
      replacement: new URL(file, root).pathname,
    };
  });
}

interface Bundle {
  /** All JavaScript, including chunks loaded on demand. */
  js: string;
  /** The JavaScript loaded up front: everything but on-demand chunks. */
  initialJs: string;
  css: string;
  /** Gzipped size of the JavaScript loaded up front (not on-demand chunks), in bytes. */
  gzip: number;
  exports: string[];
}

const VIRTUAL_ENTRY = "\0consumer.jsx";

/**
 * Bundles `source` as an app entry, like a production build would. Unminified unless
 * asked, so tests can look for function names in the output.
 */
async function bundle(source: string, { minify = false } = {}): Promise<Bundle> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root: new URL("test/bundle/", root).pathname,
    resolve: { alias: packageAliases() },
    plugins: [
      {
        name: "consumer-entry",
        enforce: "pre",
        // Vite hands lib entries over as paths relative to `root`.
        resolveId: (id) => (/(^|\/)consumer$/.test(id) ? VIRTUAL_ENTRY : null),
        load: (id) => (id === VIRTUAL_ENTRY ? source : null),
      },
    ],
    build: {
      write: false,
      minify,
      lib: { entry: "consumer", formats: ["es"], fileName: "consumer" },
      rolldownOptions: {
        // Peer dependencies stay external, as they would be resolved by the app.
        external: [/^react($|\/)/, /^react-dom($|\/)/, /^pdfjs-dist($|\/)/],
        // The library marks its modules "use client"; irrelevant outside RSC.
        onLog: () => {},
      },
    },
  });

  const outputs = (Array.isArray(result) ? result : [result]).filter(
    (output): output is Rolldown.RolldownOutput => "output" in output,
  );
  let js = "";
  let initialJs = "";
  let css = "";
  let exports: string[] = [];
  for (const item of outputs.flatMap((output) => output.output)) {
    if (item.type === "chunk") {
      js += item.code;
      if (!item.isDynamicEntry) initialJs += item.code;
      if (item.isEntry) exports = item.exports;
    } else if (item.fileName.endsWith(".css")) {
      css += String(item.source);
    }
  }
  return { js, initialJs, css, gzip: gzipSync(initialJs).length, exports };
}

// Markers that only appear in the opinionated UI's JS.
const UI_JS = /rpv-toolbar|rpv-search-bar|rpv-sidebar-inner|function PdfViewer\b/;

const HEADLESS_APP = (from: string): string => `
  import { PdfViewerProvider, PdfPages, useZoom } from "${from}";
  function ZoomIn() { const { zoomIn } = useZoom(); return <button onClick={zoomIn}>+</button>; }
  export default () => <PdfViewerProvider src="/a.pdf"><ZoomIn /><PdfPages /></PdfViewerProvider>;
`;

const HOOKS_APP = `
  import { PdfViewerProvider, usePageNavigation } from "react-pdfjs-viewer/headless";
  function Next() { const { nextPage } = usePageNavigation(); return <button onClick={nextPage}>›</button>; }
  export default () => <PdfViewerProvider src="/a.pdf"><Next /></PdfViewerProvider>;
`;

const VIEWER_APP = `
  import { PdfViewer } from "react-pdfjs-viewer/ui";
  export default () => <PdfViewer src="/a.pdf" />;
`;

describe("consumer bundles", { timeout: 30_000 }, () => {
  test("headless subpath ships no UI code", async () => {
    const { js, css } = await bundle(HEADLESS_APP("react-pdfjs-viewer/headless"));
    expect(js).toContain("rpv-pages");
    expect(js).not.toMatch(UI_JS);
    expect(css).toBe(""); // styles are the app's to import
  });

  test("the root entry tree-shakes to the same headless bundle", async () => {
    const fromRoot = await bundle(HEADLESS_APP("react-pdfjs-viewer"));
    const fromHeadless = await bundle(HEADLESS_APP("react-pdfjs-viewer/headless"));
    expect(fromRoot.js).not.toMatch(UI_JS);
    expect(fromRoot.css).toBe("");
    expect(fromRoot.gzip).toBe(fromHeadless.gzip);
  });

  test("search code is loaded on demand, not up front", async () => {
    const { js, initialJs } = await bundle(HOOKS_APP);
    expect(js).toContain("NFKC"); // the text normalization is in the output…
    expect(initialJs).not.toContain("NFKC"); // …but only in a chunk loaded on demand
  });

  test("hooks alone don't pull in the rendering primitives", async () => {
    const { js } = await bundle(HOOKS_APP);
    expect(js).not.toMatch(/rpv-pages|rpv-thumbnails|TextLayer/);
    expect(js).not.toMatch(UI_JS);
  });

  test("a single UI control doesn't pull in the whole viewer", async () => {
    const { js, css } = await bundle(`
      import { PdfViewerProvider, PdfPages } from "react-pdfjs-viewer/headless";
      import { ZoomControls } from "react-pdfjs-viewer/ui";
      export default () => <PdfViewerProvider src="/a.pdf"><ZoomControls /><PdfPages /></PdfViewerProvider>;
    `);
    expect(css).toBe("");
    expect(js).not.toMatch(/rpv-search-bar|rpv-thumbnails|function PdfViewer\b/);
  });

  test("the complete viewer includes the UI", async () => {
    const { js, css } = await bundle(VIEWER_APP);
    expect(js).toMatch(UI_JS);
    expect(css).toBe("");
  });

  // Minified and gzipped, as shipped. pdf.js itself is a lazily imported peer dependency,
  // so it isn't counted. Raise a budget deliberately, along with the feature that needs it.
  test.each([
    ["hooks only", HOOKS_APP, 6_000],
    ["headless pages", HEADLESS_APP("react-pdfjs-viewer/headless"), 13_500],
    ["complete viewer", VIEWER_APP, 23_500],
  ])("size budget: %s", async (name, source, budget) => {
    const { gzip } = await bundle(source, { minify: true });
    console.info(`${name}: ${(gzip / 1000).toFixed(1)} kB gzipped`);
    expect(gzip).toBeLessThan(budget);
  });
});

async function exportsOf(specifier: string): Promise<string[]> {
  const { exports } = await bundle(`export * from "${specifier}";`);
  return exports.toSorted();
}

describe("package entry points", { timeout: 30_000 }, () => {
  test("the root entry exports exactly headless + ui", async () => {
    const [all, headless, ui] = await Promise.all([
      exportsOf("react-pdfjs-viewer"),
      exportsOf("react-pdfjs-viewer/headless"),
      exportsOf("react-pdfjs-viewer/ui"),
    ]);
    expect(headless).toContain("PdfViewerProvider");
    expect(headless).toContain("PdfPages");
    expect(headless).not.toContain("PdfViewer");
    expect(ui).toContain("PdfViewer");
    expect(ui).not.toContain("PdfViewerProvider");
    expect(all).toEqual([...headless, ...ui].toSorted());
  });
});

/**
 * Every file `entry` statically imports, transitively. Dev servers don't tree-shake, so
 * this is what a headless app actually loads during development.
 */
function importGraph(entry: string): string[] {
  const dist = new URL("dist/", root).pathname;
  const seen = new Set<string>();
  const pending = [join(dist, entry)];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    if (!file.endsWith(".js")) continue;
    const code = readFileSync(file, "utf8");
    for (const [, specifier] of code.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
      pending.push(join(dirname(file), specifier!));
    }
  }
  return [...seen].map((file) => relative(dist, file)).toSorted();
}

describe("static import graph (what dev servers load)", () => {
  test("headless never reaches ui/", () => {
    const files = importGraph("headless.js");
    expect(files).toContain("headless/PdfPages.js");
    expect(files.filter((file) => file.startsWith("ui"))).toEqual([]);
  });

  test("no module imports CSS", () => {
    const files = importGraph("index.js");
    expect(files).toContain("ui/PdfViewer.js");
    expect(files.filter((file) => file.endsWith(".css"))).toEqual([]);
  });
});

/** Whether each selector of each style rule in `css` has zero specificity. */
function selectorSpecificity(css: string): { selector: string; isZero: boolean }[] {
  const results: { selector: string; isZero: boolean }[] = [];
  transform({
    filename: "published.css",
    code: Buffer.from(css),
    visitor: {
      Rule: {
        style(rule) {
          for (const selector of rule.value.selectors) {
            const [first] = selector;
            // Wrapped in :where(), or a bare pseudo-element like ::highlight().
            const isZero =
              first?.type === "pseudo-element" ||
              (first?.type === "pseudo-class" && first.kind === "where");
            results.push({ selector: JSON.stringify(selector), isZero });
          }
        },
      },
    },
  });
  return results;
}

function readDist(file: string): string {
  return readFileSync(new URL(`dist/${file}`, root), "utf8");
}

describe("published CSS", () => {
  test("core.css has only the core layer; ui.css includes it, then its own", () => {
    const core = readDist("core.css");
    const ui = readDist("ui.css");
    expect(core).toContain("@layer rpv.core");
    expect(core).not.toContain("rpv.ui");
    expect(core).not.toContain("rpv-toolbar");
    expect(ui.indexOf("@layer rpv.core")).toBeLessThan(ui.indexOf("@layer rpv.ui"));
    expect(ui).toContain(".rpv-text-layer");
    expect(ui).not.toContain("@import");
  });

  test("every selector has zero specificity", () => {
    for (const file of ["core.css", "ui.css"]) {
      const results = selectorSpecificity(readDist(file));
      expect(results.length).toBeGreaterThan(20);
      expect(results.filter((result) => !result.isZero).map((result) => result.selector)).toEqual(
        [],
      );
    }
  });
});
