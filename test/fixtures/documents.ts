/**
 * Shared fixtures for stories.
 *
 * Stories choose a document by *name* (the `document` arg) and receive its bytes from
 * `loadDocument`, a Storybook loader. The bytes must stay out of args and argTypes:
 * Storybook serializes those to show them in its UI, and a 15 MB Uint8Array becomes an
 * object with millions of keys, which freezes the page.
 */
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { makeBrokenPdf, makePdf } from "./make-pdf.ts";

export { workerSrc };

const builders = {
  /** Milestones on pages 10, 20, 30 and 40. */
  "40 pages": () => makePdf({ pageCount: 40, milestoneEvery: 10 }),
  /** Milestones every 100 pages. About 15 MB, so it is only built when a story needs it. */
  "5,000 pages": () => makePdf({ pageCount: 5000 }),
  "Not a PDF": () => makeBrokenPdf(),
} satisfies Record<string, () => Uint8Array>;

export type DocumentName = keyof typeof builders;

const built = new Map<DocumentName, Uint8Array>();

/** The bytes of a fixture document, built on first use. */
export function getDocument(name: DocumentName): Uint8Array {
  let bytes = built.get(name);
  if (!bytes) {
    bytes = builders[name]();
    built.set(name, bytes);
  }
  return bytes;
}

/** Args shared by stories that show a fixture document. */
export interface DocumentArgs {
  document: DocumentName;
}

/** `argTypes.document`: a document picker in the Controls panel. */
export const documentArgType = {
  name: "Document",
  options: Object.keys(builders),
  control: { type: "select" },
} as const;

/** Storybook loader: puts the chosen document's bytes in `context.loaded.src`. */
export function loadDocument({ args }: { args: DocumentArgs }): { src: Uint8Array } {
  return { src: getDocument(args.document) };
}

/** Reads the bytes `loadDocument` produced from a story's `loaded` context. */
export function loadedDocument(loaded: Record<string, unknown>): Uint8Array {
  const { src } = loaded;
  if (!(src instanceof Uint8Array)) throw new Error("Add `loaders: [loadDocument]` to the story");
  return src;
}
