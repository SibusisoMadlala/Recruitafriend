import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { Loader2 } from 'lucide-react';

function resolveUserRole(profile: Record<string, any> | null | undefined, fallback: unknown) {
  return String(profile?.userType || profile?.user_type || fallback || '').toLowerCase();
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'seeker' | 'employer' | 'admin';
  requireApprovedEmployer?: boolean;
}

export default function ProtectedRoute({ children, role, requireApprovedEmployer = false }: ProtectedRouteProps) {
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
    const userRole = resolveUserRole(profile, user.user_metadata?.userType);
    if (userRole && userRole !== role) {
      const fallback = userRole === 'employer'
        ? '/employer/dashboard'
        : userRole === 'admin'
          ? '/admin/dashboard'
          : '/seeker/dashboard';
      return <Navigate to={fallback} replace />;
    }
  }

  if (requireApprovedEmployer && role === 'employer') {
    const employerStatus = String(profile?.employer_status || '').toLowerCase();
    if (employerStatus !== 'approved') {
      return <Navigate to="/employer/onboarding-status" replace state={{ from: location.pathname }} />;
    }
  }

  return <>{children}</>;
}
