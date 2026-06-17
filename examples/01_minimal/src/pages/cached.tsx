import { Link } from 'waku';
import { cache } from '../lib/cache.js';

// Incremented only on an actual render. A cache hit replays the stored RSC
// payload instead of rendering, so the number stays put until invalidation.
let renderCount = 0;

const CachedContent = () => {
  ++renderCount;
  return (
    <div>
      <h1>Cached</h1>
      <p data-testid="cached-content">cached render #{renderCount}</p>
      <p>
        <Link to="/" data-testid="to-home">
          Go home
        </Link>
      </p>
    </div>
  );
};

const { Component, getEtag } = cache.rsc(CachedContent, {
  key: () => ['cached-page'],
});

export default Component;

export const getConfig = () => {
  return {
    render: 'dynamic',
    // Opt-in: the eager etag lets Waku skip re-sending this slot on navigation
    // while it is unchanged. Drop this line and the server render cache still
    // works; you just lose the on-the-wire skip.
    unstable_getEtag: getEtag,
  } as const;
};
