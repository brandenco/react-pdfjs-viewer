/**
 * Builds PDFs in memory for stories and tests, so nothing depends on the network or on
 * large checked-in files. Pages contain plain Helvetica text that pdf.js can extract.
 */

export interface MakePdfOptions {
  pageCount: number;
  /** Adds a "Milestone N" line to every Nth page, for search tests. Default 100. */
  milestoneEvery?: number;
  /** Makes every Nth page landscape, to exercise mixed page sizes. Default 7. */
  landscapeEvery?: number;
  /**
   * Adds document features: an outline (bookmarks) with one entry per milestone, links
   * on page 1 (to milestone 2, to a named destination, and to a website), page labels
   * (i, ii, then 1, 2, …), and document info (title, author).
   */
  extras?: boolean;
}

/** Where the extras' internal links and outline entries point (PDF user space). */
export const MILESTONE_Y = 80;
export const EXTERNAL_LINK = "https://example.com/";

const PORTRAIT = { width: 612, height: 792 }; // US Letter, in PDF points
const LANDSCAPE = { width: 792, height: 612 };
const WORDS = ["lorem", "ipsum", "dolor", "sit", "amet", "pdf", "viewer", "virtual", "scroll"];

export function makePdf(options: MakePdfOptions): Uint8Array<ArrayBuffer> {
  const { pageCount, milestoneEvery = 100, landscapeEvery = 7, extras = false } = options;
  const writer = new PdfWriter();

  const catalog = writer.reserve();
  const pageTree = writer.reserve();
  const font = writer.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // Page objects are referenced by links and the outline before they're written.
  const pages = Array.from({ length: pageCount }, () => writer.reserve());
  const milestonePages = pages.filter((_, index) => (index + 1) % milestoneEvery === 0);

  const firstPageAnnots: number[] = [];
  if (extras && milestonePages.length >= 2) {
    const link = (y: number, action: string): number =>
      writer.add(
        `<< /Type /Annot /Subtype /Link /Rect [70 ${y - 3} 300 ${y + 11}] /Border [0 0 0] ${action} >>`,
      );
    firstPageAnnots.push(
      link(LINK_Y.milestone, `/Dest ${milestoneDest(milestonePages[1]!)}`),
      link(LINK_Y.named, "/Dest (last-page)"),
      link(LINK_Y.external, `/A << /S /URI /URI (${EXTERNAL_LINK}) >>`),
    );
  }

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const size = pageNumber % landscapeEvery === 0 ? LANDSCAPE : PORTRAIT;
    let text = pageText(pageNumber, pageCount, size.height, milestoneEvery);
    if (pageNumber === 1 && firstPageAnnots.length > 0) text += `\n${linkTexts()}`;
    const content = writer.addStream(text);
    const annots =
      pageNumber === 1 && firstPageAnnots.length > 0
        ? ` /Annots [${firstPageAnnots.map((annot) => `${annot} 0 R`).join(" ")}]`
        : "";
    writer.set(
      page,
      `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${size.width} ${size.height}] ` +
        `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R${annots} >>`,
    );
  });

  let catalogExtras = "";
  let info: number | undefined;
  if (extras) {
    const outline = addOutline(writer, milestonePages, pages[0]!, pages[1] ?? pages[0]!);
    const lastPage = pages.at(-1)!;
    catalogExtras =
      ` /Outlines ${outline} 0 R /PageMode /UseOutlines` +
      ` /Names << /Dests << /Names [(last-page) [${lastPage} 0 R /Fit]] >> >>` +
      " /PageLabels << /Nums [0 << /S /r >> 2 << /S /D >>] >>";
    info = writer.add("<< /Title (Fixture document) /Author (react-pdfjs-viewer tests) >>");
  }

  writer.set(catalog, `<< /Type /Catalog /Pages ${pageTree} 0 R${catalogExtras} >>`);
  const kids = pages.map((page) => `${page} 0 R`).join(" ");
  writer.set(pageTree, `<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`);
  return writer.finish(catalog, info);
}

function milestoneDest(page: number): string {
  return `[${page} 0 R /XYZ 72 ${MILESTONE_Y} null]`;
}

/** Baselines of the link texts on page 1, in the top margin above the page title. */
const LINK_Y = { milestone: 765, named: 750, external: 735 };

function linkTexts(): string {
  return [
    textLine(11, 72, LINK_Y.milestone, "Go to milestone 2"),
    textLine(11, 72, LINK_Y.named, "Go to the last page"),
    textLine(11, 72, LINK_Y.external, "Visit example.com"),
  ].join("\n");
}

/**
 * An outline with "Introduction" (page 1, with a collapsed child "Links" on page 2) and
 * a "Milestones" entry, with no destination of its own, whose children point at each
 * milestone's line. Both kinds of parent entry, for the outline UI.
 */
function addOutline(
  writer: PdfWriter,
  milestonePages: number[],
  firstPage: number,
  secondPage: number,
): number {
  const root = writer.reserve();
  const intro = writer.reserve();
  const introChild = writer.reserve();
  const milestones = writer.reserve();
  const children = milestonePages.map(() => writer.reserve());

  writer.set(
    intro,
    `<< /Title (Introduction) /Parent ${root} 0 R /Next ${milestones} 0 R /Dest [${firstPage} 0 R /Fit]` +
      ` /First ${introChild} 0 R /Last ${introChild} 0 R /Count -1 >>`,
  );
  writer.set(
    introChild,
    `<< /Title (Links) /Parent ${intro} 0 R /Dest [${secondPage} 0 R /Fit] >>`,
  );
  const childRange =
    children.length > 0
      ? ` /First ${children[0]} 0 R /Last ${children.at(-1)} 0 R /Count ${children.length}`
      : "";
  writer.set(
    milestones,
    `<< /Title (Milestones) /Parent ${root} 0 R /Prev ${intro} 0 R${childRange} >>`,
  );
  children.forEach((child, index) => {
    const siblings =
      (index > 0 ? ` /Prev ${children[index - 1]} 0 R` : "") +
      (index < children.length - 1 ? ` /Next ${children[index + 1]} 0 R` : "");
    writer.set(
      child,
      `<< /Title (Milestone ${index + 1}) /Parent ${milestones} 0 R${siblings} ` +
        `/Dest ${milestoneDest(milestonePages[index]!)} >>`,
    );
  });
  writer.set(
    root,
    `<< /Type /Outlines /First ${intro} 0 R /Last ${milestones} 0 R /Count ${2 + children.length} >>`, // "Links" is collapsed
  );
  return root;
}

/** Bytes that are not a PDF, for the load-error state. */
export function makeBrokenPdf(): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode("This is not a PDF file.");
}

function pageText(
  pageNumber: number,
  pageCount: number,
  pageHeight: number,
  milestoneEvery: number,
): string {
  const lines = [textLine(28, 72, pageHeight - 100, `Page ${pageNumber} of ${pageCount}`)];
  for (let line = 0; line < 30; line++) {
    const words = Array.from(
      { length: 10 },
      (_, word) => WORDS[(pageNumber * 31 + line * 7 + word) % WORDS.length],
    );
    lines.push(textLine(12, 72, pageHeight - 150 - line * 18, words.join(" ")));
  }
  if (pageNumber % milestoneEvery === 0) {
    lines.push(textLine(14, 72, 60, `Milestone ${pageNumber / milestoneEvery}`));
  }
  return lines.join("\n");
}

function textLine(fontSize: number, x: number, y: number, text: string): string {
  return `BT /F1 ${fontSize} Tf ${x} ${y} Td (${text}) Tj ET`;
}

/** Writes numbered PDF objects and the cross-reference table that indexes them. */
class PdfWriter {
  readonly #objects: string[] = [];
  readonly #encoder = new TextEncoder();

  /** Reserves an object number to fill in later (for objects that reference later ones). */
  reserve(): number {
    return this.#objects.push("");
  }

  set(objectNumber: number, body: string): void {
    this.#objects[objectNumber - 1] = body;
  }

  add(body: string): number {
    return this.#objects.push(body);
  }

  addStream(content: string): number {
    const length = this.#encoder.encode(content).length;
    return this.add(`<< /Length ${length} >>\nstream\n${content}\nendstream`);
  }

  finish(rootObject: number, infoObject?: number): Uint8Array<ArrayBuffer> {
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    this.#objects.forEach((body, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    const objectCount = this.#objects.length + 1;
    pdf += `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
    for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    const info = infoObject === undefined ? "" : ` /Info ${infoObject} 0 R`;
    pdf += `trailer\n<< /Size ${objectCount} /Root ${rootObject} 0 R${info} >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return this.#encoder.encode(pdf);
  }
}
