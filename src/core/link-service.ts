/**
 * The link service pdf.js' `AnnotationLayer` calls when a link is clicked. pdf.js ships
 * one in its web viewer (`PDFLinkService`), but that module is large and expects the
 * pdf.js viewer around it. The annotation layer only calls the handful of methods below.
 */
import type { AnnotationLayer } from "pdfjs-dist";

import type { PdfDestination } from "./navigation.ts";

export type PdfjsLinkService = Parameters<AnnotationLayer["render"]>[0]["linkService"];

/** What the link service needs from the viewer. `PdfViewerStore` provides all of it. */
export interface LinkTarget {
  goToDestination(destination: PdfDestination): Promise<boolean>;
  nextPage(): void;
  previousPage(): void;
  firstPage(): void;
  lastPage(): void;
}

export interface LinkServiceOptions {
  /** Where external links open, as an `<a target>`. Default `"_blank"`. */
  externalLinkTarget?: string | undefined;
}

export function createLinkService(
  viewer: LinkTarget,
  options: LinkServiceOptions = {},
): PdfjsLinkService {
  const { externalLinkTarget = "_blank" } = options;

  const service = {
    externalLinkEnabled: true,
    isInPresentationMode: false,
    /** No event bus: scripting and editing events have no listener in this viewer. */
    eventBus: undefined,

    addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow = false): void {
      // pdf.js has already checked the URL's protocol (http, https, mailto, …).
      link.href = url;
      link.target = newWindow ? "_blank" : externalLinkTarget;
      // The document is untrusted: don't give the linked page a handle on this one.
      link.rel = "noopener noreferrer nofollow";
    },

    getDestinationHash(destination: PdfDestination): string {
      // Only used as the link's href (the click itself is handled in JS), so it just
      // needs to be a harmless, readable in-page anchor.
      return typeof destination === "string" ? `#${encodeURIComponent(destination)}` : "#";
    },

    getAnchorUrl(anchor: string): string {
      return `#${anchor}`;
    },

    goToDestination(destination: PdfDestination): Promise<boolean> {
      return viewer.goToDestination(destination);
    },

    executeNamedAction(action: string): void {
      switch (action) {
        case "NextPage":
          viewer.nextPage();
          break;
        case "PrevPage":
          viewer.previousPage();
          break;
        case "FirstPage":
          viewer.firstPage();
          break;
        case "LastPage":
          viewer.lastPage();
          break;
        default:
          // Print, find, go back/forward, …: not supported by links yet.
          break;
      }
    },

    executeSetOCGState(): Promise<void> {
      return Promise.resolve(); // optional content isn't supported yet
    },

    getAttachmentContent(): Promise<null> {
      return Promise.resolve(null); // attachments aren't supported yet
    },
  };

  // `PdfjsLinkService` is the full class from pdf.js' web viewer; the annotation layer
  // only uses the members implemented above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return service as unknown as PdfjsLinkService;
}
