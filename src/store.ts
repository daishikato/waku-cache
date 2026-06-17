/** A single cached value plus its metadata. */
export interface CacheEntry {
  /** Serialized RSC payload (Waku's `serializeRsc`) — for both `cache.rsc` subtrees and `cache.fn` values. */
  value: Uint8Array;
  /** When the entry was written (epoch ms). */
  createdAt: number;
  /** Absolute expiry (epoch ms). Omitted means no expiry. */
  expiresAt?: number;
}

/**
 * The pluggable storage contract. Keys arrive as arrays of already-encoded,
 * separator-safe segments (the cache builds them from your `CacheKey`); the
 * store joins them however it likes. `delete` removes the entry at
 * `prefix` and every entry whose key has `prefix` as a leading sub-array —
 * TanStack-style partial matching, so `['product']` covers `['product','abc']`
 * but not `['production']`. TTL is enforced lazily: `get` must return `null`
 * for an entry past its `expiresAt`.
 */
export interface CacheStore {
  get(key: readonly string[]): Promise<CacheEntry | null>;
  set(key: readonly string[], entry: CacheEntry): Promise<void>;
  delete(prefix: readonly string[]): Promise<void>;
}
