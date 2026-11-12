import { describe, expect, test, vi } from "vitest";

import { ThumbnailCache } from "../../src/core/thumbnail-cache.ts";

/** A stand-in bitmap plus the spy for its `close()`, which the cache must call to free it. */
function fakeBitmap(): { bitmap: ImageBitmap; close: ReturnType<typeof vi.fn> } {
  const close = vi.fn();
  return { bitmap: { width: 1, height: 1, close }, close };
}

describe("ThumbnailCache", () => {
  test("stores bitmaps per page and width", () => {
    const cache = new ThumbnailCache(10);
    const { bitmap } = fakeBitmap();
    cache.set(0, 120, bitmap);

    expect(cache.get(0, 120)).toBe(bitmap);
    expect(cache.get(0, 96)).toBeUndefined();
  });

  test("evicts the least recently used bitmap and frees it", () => {
    const cache = new ThumbnailCache(2);
    const [first, second, third] = [fakeBitmap(), fakeBitmap(), fakeBitmap()];
    cache.set(0, 120, first.bitmap);
    cache.set(1, 120, second.bitmap);
    cache.get(0, 120); // page 0 is now more recent than page 1
    cache.set(2, 120, third.bitmap);

    expect(cache.get(1, 120)).toBeUndefined();
    expect(second.close).toHaveBeenCalled();
    expect(cache.get(0, 120)).toBe(first.bitmap);
    expect(cache.get(2, 120)).toBe(third.bitmap);
  });

  test("replacing an entry frees the old bitmap", () => {
    const cache = new ThumbnailCache(10);
    const old = fakeBitmap();
    cache.set(0, 120, old.bitmap);
    cache.set(0, 120, fakeBitmap().bitmap);
    expect(old.close).toHaveBeenCalled();
  });

  test("clear frees everything", () => {
    const cache = new ThumbnailCache(10);
    const { bitmap, close } = fakeBitmap();
    cache.set(0, 120, bitmap);
    cache.clear();
    expect(close).toHaveBeenCalled();
    expect(cache.get(0, 120)).toBeUndefined();
  });
});
