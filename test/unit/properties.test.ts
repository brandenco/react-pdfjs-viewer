import { describe, expect, test } from "vitest";

import { loadPageLabels, pageNumberForLabel } from "../../src/core/page-labels.ts";
import { loadProperties } from "../../src/core/properties.ts";
import { makePdf } from "../fixtures/make-pdf.ts";
import { useTestDocument } from "./pdf-document.ts";

describe("loadProperties", () => {
  const withExtras = useTestDocument(() =>
    makePdf({ pageCount: 5, milestoneEvery: 2, extras: true }),
  );
  const plain = useTestDocument(() => makePdf({ pageCount: 2 }));

  test("reads the info dictionary and page labels", async () => {
    const properties = await loadProperties(withExtras.current);
    expect(properties).toMatchObject({
      title: "Fixture document",
      author: "react-pdfjs-viewer tests",
      subject: null,
      creationDate: null,
      pdfVersion: "1.4",
      permissions: null, // unencrypted: no restrictions
      pageLabels: ["i", "ii", "1", "2", "3"],
    });
    expect(properties.info["Title"]).toBe("Fixture document");
  });

  test("leaves out what the document doesn't have", async () => {
    const properties = await loadProperties(plain.current);
    expect(properties).toMatchObject({ title: null, author: null, pageLabels: null });
  });
});

describe("page labels", () => {
  const plain = useTestDocument(() => makePdf({ pageCount: 3 }));

  test("labels that only repeat page numbers count as none", async () => {
    await expect(loadPageLabels(plain.current)).resolves.toBeNull();
  });

  test("finds a page by label, exactly first, then ignoring case", () => {
    const labels = ["i", "ii", "1", "2", "A-1", "a-1"];
    expect(pageNumberForLabel(labels, "ii")).toBe(2);
    expect(pageNumberForLabel(labels, " 2 ")).toBe(4);
    expect(pageNumberForLabel(labels, "a-1")).toBe(6);
    expect(pageNumberForLabel(labels, "I")).toBe(1);
    expect(pageNumberForLabel(labels, "iii")).toBeNull();
  });
});
