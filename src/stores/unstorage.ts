import type { Storage } from 'unstorage';
import type { CacheStore } from '../store.js';

// Stored shape: bytes are base64'd so even string-only unstorage drivers work.
interface StoredEntry {
  value: string;
  createdAt: number;
  expiresAt?: number;
}

const PREFIX = 'waku-cache:';

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Adapt any [unstorage](https://unstorage.unjs.io) `Storage` into a
 * {@link CacheStore} — redis, Cloudflare KV/R2, Vercel KV, Upstash, fs, S3, and
 * more, through one adapter. Keys map to `:`-separated unstorage keys, so
 * `delete` uses unstorage's native `getKeys(base)` (e.g. a Redis
 * `SCAN MATCH`) to list only the matching subtree rather than scanning every
 * key. Native TTL is passed through where the driver supports it, and expiry is
 * also enforced lazily on read for those that don't.
 */
export function unstorageStore(storage: Storage): CacheStore {
  // Segments are percent-encoded by the cache, so they never contain ':'.
  const keyOf = (key: readonly string[]) => PREFIX + key.join(':');

  return {
    async get(key) {
      const id = keyOf(key);
      const stored = await storage.getItem<StoredEntry>(id);
      if (!stored) return null;
      if (stored.expiresAt !== undefined && stored.expiresAt <= Date.now()) {
        await storage.removeItem(id);
        return null;
      }
      return {
        value: fromBase64(stored.value),
        createdAt: stored.createdAt,
        ...(stored.expiresAt !== undefined
          ? { expiresAt: stored.expiresAt }
          : {}),
      };
    },
    async set(key, entry) {
      const stored: StoredEntry = {
        value: toBase64(entry.value),
        createdAt: entry.createdAt,
        ...(entry.expiresAt !== undefined
          ? { expiresAt: entry.expiresAt }
          : {}),
      };
      const ttlSeconds =
        entry.expiresAt !== undefined
          ? Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000))
          : undefined;
      await storage.setItem(
        keyOf(key),
        stored,
        ttlSeconds !== undefined ? { ttl: ttlSeconds } : {},
      );
    },
    async delete(prefix) {
      // getKeys(base) returns the descendants (not the base node itself), so
      // remove the exact entry too.
      const base = keyOf(prefix);
      const descendants = await storage.getKeys(base);
      await Promise.all([
        storage.removeItem(base),
        ...descendants.map((key) => storage.removeItem(key)),
      ]);
    },
  };
}
