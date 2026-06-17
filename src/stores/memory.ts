import type { CacheEntry, CacheStore } from '../store.js';

/**
 * In-memory store: a `Map` with lazy TTL expiry on read, and a structural
 * partial-match `delete` (the same approach as TanStack Query). Zero
 * dependencies; ideal for dev, tests, and small single-node servers. State
 * lives for the lifetime of the process.
 */
export function memoryStore(): CacheStore {
  const entries = new Map<string, CacheEntry>();
  const idOf = (key: readonly string[]) => key.join(':');

  return {
    async get(key) {
      const id = idOf(key);
      const entry = entries.get(id);
      if (!entry) return null;
      if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
        entries.delete(id);
        return null;
      }
      return entry;
    },
    async set(key, entry) {
      entries.set(idOf(key), entry);
    },
    async delete(prefix) {
      if (prefix.length === 0) {
        entries.clear();
        return;
      }
      const base = idOf(prefix);
      for (const id of [...entries.keys()]) {
        if (id === base || id.startsWith(base + ':')) entries.delete(id);
      }
    },
  };
}
