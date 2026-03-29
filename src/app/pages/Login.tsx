import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function resolveUserType(profile: Record<string, any> | null | undefined, fallback: unknown) {
  return String(profile?.userType || profile?.user_type || fallback || 'seeker').toLowerCase();
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
              disabled={loading}
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
