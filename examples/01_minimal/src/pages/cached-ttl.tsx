import { Link } from 'waku';
import { cache } from '../lib/cache.js';

// Same idea as /cached, but cached with a short TTL instead of relying on
// invalidation. The etag tracks the entry's content, so it changes once the
// entry expires and is re-rendered.
let renderCount = 0;

const CachedTtlContent = () => {
  ++renderCount;
  return (
    <div>
      <h1>Cached (TTL)</h1>
      <p data-testid="cached-ttl-content">cached-ttl render #{renderCount}</p>
      <p>
        <Link to="/" data-testid="ttl-to-home">
          Go home
        </Link>
      </p>
    </div>
  );
};

const { Component, getEtag } = cache.rsc(CachedTtlContent, {
  key: () => ['cached-ttl-page'],
  ttl: 1000,
});

export default Component;

export const getConfig = () => {
  return {
    render: 'dynamic',
    unstable_getEtag: getEtag,
  } as const;
};
