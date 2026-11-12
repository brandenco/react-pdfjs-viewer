/**
 * Accessible names for the link layer's links. pdf.js renders each link as an empty
 * `<a>` over the page. It names internal links (a `title` with the text under them) but
 * not external ones, so screen readers would announce those as just "link".
 *
 * Each unnamed link is named after the text it covers on the page, which is what
 * sighted users read, found from layout so it works at any zoom or rotation. An
 * external link over no text falls back to its URL.
 */
export function nameLinks(annotationLayer: HTMLElement, textLayer: HTMLElement): void {
  const links = [...annotationLayer.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(
    (link) => !hasName(link),
  );
  if (links.length === 0) return;

  const words = [...textLayer.querySelectorAll("span")]
    .filter((span) => span.childElementCount === 0 && span.textContent.trim() !== "")
    .map((span) => ({ text: span.textContent.trim(), box: span.getBoundingClientRect() }));

  for (const link of links) {
    const box = link.getBoundingClientRect();
    const covered = words
      .filter(({ box: word }) => {
        const x = word.left + word.width / 2;
        const y = word.top + word.height / 2;
        return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      })
      .map(({ text }) => text);

    const isInternal = link.getAttribute("href")?.startsWith("#") ?? true;
    const name = covered.join(" ") || (isInternal ? "Link" : link.href);
    link.setAttribute("aria-label", name);
  }
}

function hasName(link: HTMLAnchorElement): boolean {
  return (
    link.textContent.trim() !== "" ||
    Boolean(link.getAttribute("aria-label")) ||
    Boolean(link.getAttribute("title"))
  );
}
