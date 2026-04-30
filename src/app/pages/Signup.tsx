import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';
import { Loader2, Users, Building2, Eye, EyeOff } from 'lucide-react';

function resolveUserType(profile: Record<string, any> | null | undefined, fallback: unknown) {
  return String(profile?.userType || profile?.user_type || fallback || 'seeker').toLowerCase();
}

function resolveDestination(profile: Record<string, any> | null | undefined, fallback: unknown) {
  const resolved = resolveUserType(profile, fallback);
  const employerStatus = String(profile?.employer_status || '').toLowerCase();

  if (resolved === 'admin') return '/admin/dashboard';
  if (resolved === 'employer' && employerStatus !== 'approved') return '/employer/onboarding-status';
  if (resolved === 'employer') return '/employer/dashboard';
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

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signUpWithGoogle, user, profile, loading: authLoading } = useAuth();
  
  const [userType, setUserType] = useState<'seeker' | 'employer'>('seeker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'employer') {
      setUserType('employer');
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user) return;
    navigate(resolveDestination(profile, user.user_metadata?.userType), { replace: true });
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp(email, password, name, userType);
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (userType === 'employer') {
      toast.info('Employer onboarding with Google is coming soon. Please use email signup for employer accounts.');
      return;
    }

    setGoogleLoading(true);
    try {
      await signUpWithGoogle('/signup');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sign up with Google');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="text-2xl font-bold text-[var(--rf-navy)] sm:text-3xl">Recruit</span>
              <span className="text-2xl font-bold text-[var(--rf-green)] sm:text-3xl">Friend</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Create Your Account</h2>
            <p className="text-[var(--rf-muted)] mt-2">Join thousands of South Africans finding their dream jobs</p>
          </div>

          {/* User Type Selection */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setUserType('seeker')}
              className={`p-4 rounded-[var(--rf-radius-md)] border-2 transition-all ${
              userType === 'seeker'
                ? 'border-[var(--rf-green)] bg-[var(--rf-green)] bg-opacity-20'
                : 'border-[var(--rf-border)] hover:border-[var(--rf-green)] bg-opacity-10'
              }`}
            >
              <Users className={`w-6 h-6 mx-auto mb-2 ${userType === 'seeker' ? 'text-white' : 'text-[var(--rf-muted)]'}`} />
              <div className={`text-sm font-semibold ${userType === 'seeker' ? 'text-white' : 'text-[var(--rf-text)]'}`}>
              Job Seeker
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setUserType('employer')}
              className={`p-4 rounded-[var(--rf-radius-md)] border-2 transition-all ${
              userType === 'employer'
              ? 'border-[var(--rf-green)] bg-[var(--rf-green)] bg-opacity-10'
              : 'border-[var(--rf-border)] hover:border-[var(--rf-green)] bg-opacity-0'
              }`}
            >
              <Building2 className={`w-6 h-6 mx-auto mb-2 ${userType === 'employer' ? 'text-white' : 'text-[var(--rf-muted)]'}`} />
              <div className={`text-sm font-semibold ${userType === 'employer' ? 'text-white' : 'text-[var(--rf-text)]'}`}>
              Employer
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                {userType === 'employer' ? 'Company Name' : 'Full Name'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                placeholder={userType === 'employer' ? 'Your Company' : 'John Doe'}
              />
            </div>

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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-[var(--rf-muted)] hover:text-[var(--rf-navy)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-[var(--rf-muted)] mt-1">
                At least 6 characters
              </p>
            </div>

            <div className="flex items-start">
              <input type="checkbox" required className="mt-1 mr-2" />
              <span className="text-sm text-[var(--rf-muted)]">
                I agree to the{' '}
                <Link to="/terms" className="font-semibold text-[var(--rf-green)] hover:underline">
                  Terms &amp; Conditions
                </Link>{' '}
                and Privacy Policy
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading || authLoading}
              className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
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
              onClick={handleGoogleSignup}
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

            {userType === 'employer' && (
              <p className="text-xs text-[var(--rf-muted)] text-center">
                Google sign-up currently creates job seeker accounts only.
              </p>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--rf-muted)]">
              Already have an account?{' '}
              <Link to="/login" className="text-[var(--rf-green)] hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
