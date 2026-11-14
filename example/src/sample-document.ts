// A 40-page sample with an outline, links, page labels and document info, generated in
// memory by the test fixtures so the repository needs no binary PDF. In your app, `src`
// is usually just a URL: `<PdfViewer src="/report.pdf" />`.
import { makePdf } from "../../test/fixtures/make-pdf.ts";

export const sampleDocument: Uint8Array = makePdf({
  pageCount: 40,
  milestoneEvery: 10,
  extras: true,
});
