import { Link } from 'waku';

const HomePage = () => (
  <div>
    <h1 data-testid="home-heading">Home</h1>
    <p>
      <Link to="/cached" data-testid="to-cached">
        Go to cached
      </Link>
    </p>
    <p>
      <Link to="/cached-ttl" data-testid="to-cached-ttl">
        Go to cached (TTL)
      </Link>
    </p>
  </div>
);

export default HomePage;

export const getConfig = () => {
  return {
    render: 'dynamic',
  } as const;
};
