import { describe, expect, test } from "vitest";

import { filenameFromSource, toInitSource } from "../../src/core/document.ts";

describe("toInitSource", () => {
  test("passes URLs through", () => {
    expect(toInitSource("https://example.com/a.pdf")).toEqual({ url: "https://example.com/a.pdf" });
    const url = new URL("https://example.com/b.pdf");
    expect(toInitSource(url)).toEqual({ url });
  });

  test("copies bytes, because pdf.js detaches the buffer it is given", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { data } = toInitSource(bytes);
    expect(data).toEqual(bytes);
    expect(data).not.toBe(bytes);
  });

  test("accepts an ArrayBuffer", () => {
    const { data } = toInitSource(new Uint8Array([4, 5]).buffer);
    expect(data).toEqual(new Uint8Array([4, 5]));
  });
});

describe("filenameFromSource", () => {
  test("uses the PDF filename at the end of a URL", () => {
    expect(filenameFromSource("https://example.com/docs/Annual%20Report.pdf")).toBe(
      "Annual Report.pdf",
    );
    expect(filenameFromSource("https://example.com/file.PDF?download=1")).toBe("file.PDF");
  });

  test("returns undefined when there is no PDF filename", () => {
    expect(filenameFromSource("https://example.com/download?id=7")).toBeUndefined();
    expect(filenameFromSource(new Uint8Array())).toBeUndefined();
  });
});
