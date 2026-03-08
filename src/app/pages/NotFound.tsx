import { Link } from 'react-router';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)]">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-[var(--rf-green)]">404</h1>
        <h2 className="text-3xl font-bold text-[var(--rf-navy)] mb-4">Page Not Found</h2>
        <p className="text-[var(--rf-muted)] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold"
        >
          <Home className="w-5 h-5 mr-2" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
