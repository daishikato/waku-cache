import { createCache } from 'waku-cache';
import { memoryStore } from 'waku-cache/stores/memory';

export const cache = createCache({ store: memoryStore() });
