import { createStorage } from 'unstorage';
import { describe, expect, test, vi } from 'vitest';
import { createCache } from 'waku-cache';
import { memoryStore } from 'waku-cache/stores/memory';
import { unstorageStore } from 'waku-cache/stores/unstorage';

// cache.fn / cache.rsc serialize with Waku's serializeRsc, which needs the
// react-server runtime. Stub it with a trivial JSON serializer so the caching
// logic is testable here; the real serializer is exercised by the e2e.
vi.mock('waku/server', () => ({
  serializeRsc: (value: unknown) =>
    Promise.resolve(new TextEncoder().encode(JSON.stringify(value) ?? 'null')),
  deserializeRsc: (bytes: Uint8Array) =>
    Promise.resolve(JSON.parse(new TextDecoder().decode(bytes))),
}));

const stores = [
  ['memory', () => memoryStore()],
  ['unstorage', () => unstorageStore(createStorage())],
] as const;

describe.each(stores)('cache.fn (%s store)', (_name, makeStore) => {
  test('caches by key (computes once per key)', async () => {
    const cache = createCache({ store: makeStore() });
    const spy = vi.fn((id: string) => Promise.resolve(id.toUpperCase()));
    const get = cache.fn(spy, { key: (id) => ['item', id] });
    expect(await get('x')).toBe('X');
    expect(await get('x')).toBe('X');
    expect(spy).toHaveBeenCalledTimes(1);
    await get('y');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('invalidate matches by prefix: parent key drops descendants, not siblings', async () => {
    const cache = createCache({ store: makeStore() });
    let calls = 0;
    const getProduct = cache.fn(
      (id: string) => {
        calls++;
        return Promise.resolve(id);
      },
      { key: (id) => ['product', id] },
    );
    const getProduction = cache.fn(
      () => {
        calls++;
        return Promise.resolve('o');
      },
      { key: () => ['production'] }, // a sibling key that shares a string prefix
    );
    await getProduct('a');
    await getProduct('b');
    await getProduction();
    expect(calls).toBe(3);

    await cache.invalidate({ key: ['product'] });

    await getProduction(); // still cached -> no recompute
    expect(calls).toBe(3);
    await getProduct('a'); // dropped -> recompute
    await getProduct('b'); // dropped -> recompute
    expect(calls).toBe(5);
  });

  test('single-flight collapses concurrent misses', async () => {
    const cache = createCache({ store: makeStore() });
    let calls = 0;
    const get = cache.fn(
      async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        return calls;
      },
      { key: () => ['k'] },
    );
    const [a, b] = await Promise.all([get(), get()]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
  });

  test('TTL expiry recomputes', async () => {
    vi.useFakeTimers();
    try {
      const cache = createCache({
        store: makeStore(),
        defaults: { ttl: 1000 },
      });
      const spy = vi.fn(() => Promise.resolve(1));
      const get = cache.fn(spy, { key: () => ['k'] });
      await get();
      await get();
      expect(spy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1001);
      await get();
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('cache.rsc getEtag (content hash of the cached subtree)', () => {
  test('stable until content changes (invalidation re-renders new content)', async () => {
    const cache = createCache({ store: memoryStore() });
    let n = 0;
    const { getEtag } = cache.rsc(() => `v${++n}`, { key: () => ['card'] });
    const e1 = await getEtag({}); // fills: content "v1"
    expect(await getEtag({})).toBe(e1); // fresh hit: same content, same tag
    await cache.invalidate({ key: ['card'] });
    expect(await getEtag({})).not.toBe(e1); // re-rendered "v2": new tag
  });

  test('re-rendering identical content keeps the same etag', async () => {
    const cache = createCache({ store: memoryStore() });
    const { getEtag } = cache.rsc(() => 'same', { key: () => ['card'] });
    const e1 = await getEtag({});
    await cache.invalidate({ key: ['card'] });
    expect(await getEtag({})).toBe(e1); // identical bytes -> identical tag
  });
});
