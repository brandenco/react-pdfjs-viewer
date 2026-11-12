import type { PDFDocumentProxy } from "pdfjs-dist";

import { loadPdfjs } from "./pdfjs.ts";

/** What the document's author allows. Not enforced by pdf.js; it's up to the viewer. */
export interface DocumentPermissions {
  print: boolean;
  /** Printing at full quality, not just a low-resolution rendition. */
  printHighQuality: boolean;
  copy: boolean;
  /** Copying for assistive technology, even when `copy` is false. */
  copyForAccessibility: boolean;
  modifyContents: boolean;
  modifyAnnotations: boolean;
  fillForms: boolean;
  assemble: boolean;
}

/** What the document allows, or `null` when it sets no restrictions. */
export async function loadPermissions(doc: PDFDocumentProxy): Promise<DocumentPermissions | null> {
  const [pdfjs, flags] = await Promise.all([loadPdfjs(), doc.getPermissions()]);
  return flags ? toPermissions(flags, pdfjs.PermissionFlag) : null;
}

function toPermissions(
  flags: ReadonlySet<number>,
  flag: Record<
    | "PRINT"
    | "PRINT_HIGH_QUALITY"
    | "COPY"
    | "COPY_FOR_ACCESSIBILITY"
    | "MODIFY_CONTENTS"
    | "MODIFY_ANNOTATIONS"
    | "FILL_INTERACTIVE_FORMS"
    | "ASSEMBLE",
    number
  >,
): DocumentPermissions {
  return {
    print: flags.has(flag.PRINT),
    printHighQuality: flags.has(flag.PRINT_HIGH_QUALITY),
    copy: flags.has(flag.COPY),
    copyForAccessibility: flags.has(flag.COPY_FOR_ACCESSIBILITY),
    modifyContents: flags.has(flag.MODIFY_CONTENTS),
    modifyAnnotations: flags.has(flag.MODIFY_ANNOTATIONS),
    fillForms: flags.has(flag.FILL_INTERACTIVE_FORMS),
    assemble: flags.has(flag.ASSEMBLE),
  };
}
