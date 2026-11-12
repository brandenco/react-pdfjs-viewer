"use client";

import { loadProperties, type DocumentProperties } from "../core/properties.ts";
import { useDocumentData, type DocumentData } from "./use-document-data.ts";

/** Title, author, dates, permissions, page labels and raw metadata. Loaded on first use. */
export function useDocumentProperties(): DocumentData<DocumentProperties> {
  return useDocumentData(loadProperties);
}
