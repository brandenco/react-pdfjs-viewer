/**
 * Search highlighting on the text layer.
 *
 * Uses the CSS Custom Highlight API, which paints ranges without touching the DOM
 * (styled with `::highlight()`). Browsers without it get matches wrapped in `<mark>`.
 *
 * Highlight names are global to the whole page, so each text layer adds its own ranges
 * to the shared `Highlight` objects and later removes exactly those ranges. We never
 * call `CSS.highlights.clear()`, which would also remove the host app's highlights.
 */
import type { ItemSegment } from "./text.ts";

const MATCH_HIGHLIGHT = "rpv-search-match";
const ACTIVE_MATCH_HIGHLIGHT = "rpv-search-active";

export interface AppliedHighlights {
  /** The active match's range or element (anything with a bounding rect), if on this page. */
  active: Range | Element | null;
  /** Removes the highlights again. */
  remove: () => void;
}

/**
 * @param divs pdf.js `TextLayer#textDivs`: one span per text item, its text as the only child.
 * @param strings pdf.js `TextLayer#textContentItemsStr`, in the same order as `divs`.
 */
export function applyHighlights(
  divs: readonly HTMLElement[],
  strings: readonly string[],
  segments: readonly ItemSegment[],
): AppliedHighlights {
  return supportsHighlightApi()
    ? highlightWithRanges(divs, segments)
    : highlightWithMarks(divs, strings, segments);
}

function supportsHighlightApi(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight === "function";
}

function highlightWithRanges(
  divs: readonly HTMLElement[],
  segments: readonly ItemSegment[],
): AppliedHighlights {
  const matchHighlight = getSharedHighlight(MATCH_HIGHLIGHT, 0);
  const activeHighlight = getSharedHighlight(ACTIVE_MATCH_HIGHLIGHT, 1); // painted on top
  const added: { range: Range; highlight: Highlight }[] = [];
  let active: Range | null = null;

  for (const segment of segments) {
    // Ranges must start and end on text nodes, not on elements.
    const textNode = divs[segment.item]?.firstChild;
    if (!(textNode instanceof Text)) continue;

    const range = new Range();
    range.setStart(textNode, Math.min(segment.start, textNode.length));
    range.setEnd(textNode, Math.min(segment.end, textNode.length));

    const highlight = segment.isActive ? activeHighlight : matchHighlight;
    highlight.add(range);
    added.push({ range, highlight });
    if (segment.isActive) active ??= range;
  }

  function remove(): void {
    for (const { range, highlight } of added) highlight.delete(range);
  }
  return { active, remove };
}

function getSharedHighlight(name: string, priority: number): Highlight {
  let highlight = CSS.highlights.get(name);
  if (!highlight) {
    highlight = new Highlight();
    highlight.priority = priority;
    CSS.highlights.set(name, highlight);
  }
  return highlight;
}

function highlightWithMarks(
  divs: readonly HTMLElement[],
  strings: readonly string[],
  segments: readonly ItemSegment[],
): AppliedHighlights {
  const segmentsByItem = groupByItem(segments);
  let active: Element | null = null;

  for (const [item, itemSegments] of segmentsByItem) {
    const div = divs[item];
    const text = strings[item];
    if (!div || text === undefined) continue;

    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const segment of itemSegments.toSorted((a, b) => a.start - b.start)) {
      if (segment.start < position) continue; // overlaps the previous segment

      fragment.append(text.slice(position, segment.start));
      const mark = document.createElement("mark");
      mark.className = segment.isActive ? "rpv-mark rpv-mark-active" : "rpv-mark";
      mark.textContent = text.slice(segment.start, segment.end); // never innerHTML
      fragment.append(mark);
      if (segment.isActive) active ??= mark;
      position = segment.end;
    }
    fragment.append(text.slice(position));
    div.replaceChildren(fragment);
  }

  function remove(): void {
    for (const item of segmentsByItem.keys()) {
      const div = divs[item];
      const text = strings[item];
      if (div && text !== undefined) div.textContent = text;
    }
  }
  return { active, remove };
}

function groupByItem(segments: readonly ItemSegment[]): Map<number, ItemSegment[]> {
  const groups = new Map<number, ItemSegment[]>();
  for (const segment of segments) {
    const group = groups.get(segment.item);
    if (group) group.push(segment);
    else groups.set(segment.item, [segment]);
  }
  return groups;
}
