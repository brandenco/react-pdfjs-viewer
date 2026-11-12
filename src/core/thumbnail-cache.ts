/**
 * Rendered thumbnails, so scrolling the sidebar back and forth doesn't re-render pages.
 * Keeps at most `maxEntries`, dropping the least recently used.
 */
export class ThumbnailCache {
  readonly #maxEntries: number;
  // A Map iterates in insertion order, so its first key is always the least recently used.
  readonly #bitmaps = new Map<string, ImageBitmap>();

  constructor(maxEntries: number) {
    this.#maxEntries = maxEntries;
  }

  get(pageIndex: number, width: number): ImageBitmap | undefined {
    const key = cacheKey(pageIndex, width);
    const bitmap = this.#bitmaps.get(key);
    if (bitmap) {
      // Move to the end: most recently used.
      this.#bitmaps.delete(key);
      this.#bitmaps.set(key, bitmap);
    }
    return bitmap;
  }

  set(pageIndex: number, width: number, bitmap: ImageBitmap): void {
    const key = cacheKey(pageIndex, width);
    this.#delete(key);
    this.#bitmaps.set(key, bitmap);

    for (const oldestKey of this.#bitmaps.keys()) {
      if (this.#bitmaps.size <= this.#maxEntries) break;
      this.#delete(oldestKey);
    }
  }

  clear(): void {
    for (const bitmap of this.#bitmaps.values()) bitmap.close();
    this.#bitmaps.clear();
  }

  /** Removes an entry and frees its bitmap's memory right away. */
  #delete(key: string): void {
    this.#bitmaps.get(key)?.close();
    this.#bitmaps.delete(key);
  }
}

function cacheKey(pageIndex: number, width: number): string {
  return `${pageIndex}@${width}`;
}
