/**
 * Document properties: what's needed for a "Document properties" panel, and for
 * deciding whether to offer printing or copying. The raw pdf.js values are included
 * for anything not covered here.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

import { readDocumentData } from "./document-data.ts";
import { loadPageLabels } from "./page-labels.ts";
import { loadPdfjs } from "./pdfjs.ts";
import { loadPermissions, type DocumentPermissions } from "./permissions.ts";

type PdfjsMetadata = Awaited<ReturnType<PDFDocumentProxy["getMetadata"]>>["metadata"];

export interface DocumentProperties {
  /** From the XMP metadata (`dc:title`) or the info dictionary. `null` if neither has one. */
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  /** The application that created the original document. */
  creator: string | null;
  /** The application that produced the PDF. */
  producer: string | null;
  creationDate: Date | null;
  modificationDate: Date | null;
  /** e.g. `"1.7"`. */
  pdfVersion: string | null;
  /** `null` when the document sets no restrictions. */
  permissions: DocumentPermissions | null;
  /** The label of each page ("i", "ii", "1", "A-1", …), or `null` if it has none. */
  pageLabels: readonly string[] | null;
  /** The raw info dictionary, as pdf.js returns it. */
  info: Readonly<Record<string, unknown>>;
  /** The parsed XMP metadata (`metadata.get("dc:creator")`, …), if the document has any. */
  metadata: PdfjsMetadata | null;
}

export async function loadProperties(doc: PDFDocumentProxy): Promise<DocumentProperties> {
  const [pdfjs, { info, metadata }, permissions, pageLabels] = await Promise.all([
    loadPdfjs(),
    doc.getMetadata(),
    readDocumentData(doc, loadPermissions),
    readDocumentData(doc, loadPageLabels),
  ]);

  const infoRecord: Record<string, unknown> = { ...info };
  const text = (key: string): string | null => {
    const value = infoRecord[key];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };
  const date = (key: string): Date | null => {
    const value = text(key);
    return value === null ? null : pdfjs.PDFDateString.toDateObject(value);
  };
  // pdf.js resolves to `null` for documents without XMP metadata, despite its types.
  const xmp = metadata as PdfjsMetadata | null;
  const xmpTitle: unknown = xmp?.get("dc:title");

  return {
    title:
      (typeof xmpTitle === "string" && xmpTitle.trim() !== "" ? xmpTitle : null) ?? text("Title"),
    author: text("Author"),
    subject: text("Subject"),
    keywords: text("Keywords"),
    creator: text("Creator"),
    producer: text("Producer"),
    creationDate: date("CreationDate"),
    modificationDate: date("ModDate"),
    pdfVersion: text("PDFFormatVersion"),
    permissions,
    pageLabels,
    info: infoRecord,
    metadata: xmp,
  };
}
