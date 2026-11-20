import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Page not found</h1>
      <Link to="/">Back to start</Link>
    </div>
  );
}
