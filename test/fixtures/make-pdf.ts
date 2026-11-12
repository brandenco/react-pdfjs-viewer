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
}

const PORTRAIT = { width: 612, height: 792 }; // US Letter, in PDF points
const LANDSCAPE = { width: 792, height: 612 };
const WORDS = ["lorem", "ipsum", "dolor", "sit", "amet", "pdf", "viewer", "virtual", "scroll"];

export function makePdf(options: MakePdfOptions): Uint8Array<ArrayBuffer> {
  const { pageCount, milestoneEvery = 100, landscapeEvery = 7 } = options;
  const writer = new PdfWriter();

  const catalog = writer.reserve();
  const pageTree = writer.reserve();
  const font = writer.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pages: number[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const size = pageNumber % landscapeEvery === 0 ? LANDSCAPE : PORTRAIT;
    const content = writer.addStream(pageText(pageNumber, pageCount, size.height, milestoneEvery));
    pages.push(
      writer.add(
        `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${size.width} ${size.height}] ` +
          `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }

  writer.set(catalog, `<< /Type /Catalog /Pages ${pageTree} 0 R >>`);
  const kids = pages.map((page) => `${page} 0 R`).join(" ");
  writer.set(pageTree, `<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`);
  return writer.finish(catalog);
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

  finish(rootObject: number): Uint8Array<ArrayBuffer> {
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
    pdf += `trailer\n<< /Size ${objectCount} /Root ${rootObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return this.#encoder.encode(pdf);
  }
}
