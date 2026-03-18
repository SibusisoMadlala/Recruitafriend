import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';
import { Loader2, Users, Building2 } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();
  
  const [userType, setUserType] = useState<'seeker' | 'employer'>('seeker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'employer') {
      setUserType('employer');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp(email, password, name, userType);
      toast.success('Account created successfully!');
      navigate(userType === 'seeker' ? '/seeker/dashboard' : '/employer/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
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
            <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Create Your Account</h2>
            <p className="text-[var(--rf-muted)] mt-2">Join thousands of South Africans finding their dream jobs</p>
          </div>

          {/* User Type Selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={() => setUserType('seeker')}
              className={`p-4 rounded-[var(--rf-radius-md)] border-2 transition-all ${
                userType === 'seeker'
                  ? 'border-[var(--rf-green)] bg-[var(--rf-green)] bg-opacity-10'
                  : 'border-[var(--rf-border)] hover:border-[var(--rf-green)]'
              }`}
            >
              <Users className={`w-6 h-6 mx-auto mb-2 ${userType === 'seeker' ? 'text-[var(--rf-green)]' : 'text-[var(--rf-muted)]'}`} />
              <div className={`text-sm font-semibold ${userType === 'seeker' ? 'text-[var(--rf-green)]' : 'text-[var(--rf-text)]'}`}>
                Job Seeker
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setUserType('employer')}
              className={`p-4 rounded-[var(--rf-radius-md)] border-2 transition-all ${
                userType === 'employer'
                  ? 'border-[var(--rf-green)] bg-[var(--rf-green)] bg-opacity-10'
                  : 'border-[var(--rf-border)] hover:border-[var(--rf-green)]'
              }`}
            >
              <Building2 className={`w-6 h-6 mx-auto mb-2 ${userType === 'employer' ? 'text-[var(--rf-green)]' : 'text-[var(--rf-muted)]'}`} />
              <div className={`text-sm font-semibold ${userType === 'employer' ? 'text-[var(--rf-green)]' : 'text-[var(--rf-text)]'}`}>
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
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                placeholder="••••••••"
                minLength={6}
              />
              <p className="text-xs text-[var(--rf-muted)] mt-1">
                At least 6 characters
              </p>
            </div>

            <div className="flex items-start">
              <input type="checkbox" required className="mt-1 mr-2" />
              <span className="text-sm text-[var(--rf-muted)]">
                I agree to the Terms of Service and Privacy Policy
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
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
