/**
 * Layout of a vertical list of variable-height items (pages, thumbnails), with a gap
 * before, between and after them. Positions are precomputed once, so finding the item
 * at a scroll position is a binary search.
 */
export interface ListLayout {
  readonly count: number;
  readonly gap: number;
  /** Top of each item, in px from the top of the list. */
  readonly tops: Float64Array;
  /** Height of each item, in px. */
  readonly heights: Float64Array;
  /** Height of the whole list, including gaps. */
  readonly totalHeight: number;
}

export function computeListLayout(
  count: number,
  heightOf: (index: number) => number,
  gap: number,
): ListLayout {
  const tops = new Float64Array(count);
  const heights = new Float64Array(count);

  let y = gap;
  for (let index = 0; index < count; index++) {
    const height = heightOf(index);
    tops[index] = y;
    heights[index] = height;
    y += height + gap;
  }
  return { count, gap, tops, heights, totalHeight: count > 0 ? y : 0 };
}

/** The item at vertical position `y` (or the gap just below it), clamped to the list. */
export function itemIndexAt(layout: ListLayout, y: number): number {
  let low = 0;
  let high = layout.count - 1;
  while (low < high) {
    const middle = (low + high + 1) >>> 1;
    if (layout.tops[middle]! <= y) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** First and last index (inclusive) of the items to render. */
export interface VisibleRange {
  readonly first: number;
  readonly last: number;
}

export const NOTHING_VISIBLE: VisibleRange = { first: 0, last: -1 };

/** The items that overlap the band from `top` to `bottom`. */
export function itemsBetween(layout: ListLayout, top: number, bottom: number): VisibleRange {
  if (layout.count === 0) return NOTHING_VISIBLE;
  return { first: itemIndexAt(layout, top), last: itemIndexAt(layout, bottom) };
}

export function isSameRange(a: VisibleRange, b: VisibleRange): boolean {
  return a.first === b.first && a.last === b.last;
}

/** The indexes from `range.first` to `range.last`, for rendering with `.map()`. */
export function indexesIn(range: VisibleRange): number[] {
  const indexes: number[] = [];
  for (let index = range.first; index <= range.last; index++) indexes.push(index);
  return indexes;
}
