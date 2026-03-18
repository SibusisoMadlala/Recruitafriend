import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'seeker' | 'employer';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--rf-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--rf-green)]" />
      </div>
    );
  }

  // Not authenticated → redirect to login, preserving intended destination
  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Role mismatch → redirect to correct dashboard
  if (role) {
    const userRole = profile?.userType || user.user_metadata?.userType;
    if (userRole && userRole !== role) {
      const fallback = userRole === 'employer' ? '/employer/dashboard' : '/seeker/dashboard';
      return <Navigate to={fallback} replace />;
    }
  }

  return <>{children}</>;
}
