import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function resolveUserType(profile: Record<string, any> | null | undefined, fallback: unknown) {
  return String(profile?.userType || profile?.user_type || fallback || 'seeker').toLowerCase();
}

function resolveDestination(profile: Record<string, any> | null | undefined, fallback: unknown) {
  const userType = resolveUserType(profile, fallback);
  const employerStatus = String(profile?.employer_status || '').toLowerCase();

  if (userType === 'admin') return '/admin/dashboard';
  if (userType === 'employer' && employerStatus !== 'approved') return '/employer/onboarding-status';
  if (userType === 'employer') return '/employer/dashboard';
  return '/seeker/dashboard';
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.51 5.51 0 0 1-2.39 3.62v3.01h3.86c2.26-2.08 3.57-5.15 3.57-8.66Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.86-3.01c-1.07.72-2.44 1.15-4.09 1.15-3.14 0-5.8-2.12-6.75-4.97H1.26v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.25 14.26A7.2 7.2 0 0 1 4.87 12c0-.78.13-1.54.38-2.26v-3.1H1.26A12 12 0 0 0 0 12c0 1.93.46 3.75 1.26 5.36l3.99-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.81l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.26 6.64l3.99 3.1c.95-2.85 3.61-4.97 6.75-4.97Z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle, user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const redirect = searchParams.get('redirect');
    if (redirect) {
      navigate(redirect, { replace: true });
      return;
    }

    navigate(resolveDestination(profile, user.user_metadata?.userType), { replace: true });
  }, [authLoading, user, profile, searchParams, navigate]);

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      toast.success('Email verified successfully. You can sign in now.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { user, profile } = await signIn(email, password);
      toast.success('Welcome back!');
      
      const redirect = searchParams.get('redirect');
      if (redirect) {
        navigate(redirect);
        return;
      }
      
      const userType = resolveUserType(profile, user.user_metadata?.userType);
      const employerStatus = String(profile?.employer_status || '').toLowerCase();
      if (userType === 'admin') {
        navigate('/admin/dashboard');
      } else if (userType === 'employer' && employerStatus !== 'approved') {
        navigate('/employer/onboarding-status');
      } else if (userType === 'employer') {
        navigate('/employer/dashboard');
      } else {
        navigate('/seeker/dashboard');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirect = searchParams.get('redirect');
      const returnPath = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
      await signInWithGoogle(returnPath);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-3xl font-bold text-[var(--rf-navy)]">Recruit</span>
              <span className="text-3xl font-bold text-[var(--rf-green)]">Friend</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Welcome Back</h2>
            <p className="text-[var(--rf-muted)] mt-2">Sign in to continue your job search</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-[var(--rf-muted)]">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-[var(--rf-green)] hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading || authLoading}
              className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-[var(--rf-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-[var(--rf-muted)]">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading || authLoading}
              className="w-full py-3 border border-[var(--rf-border)] text-[var(--rf-text)] rounded-[var(--rf-radius-md)] hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecting to Google...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--rf-muted)]">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[var(--rf-green)] hover:underline font-semibold">
                Register now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
