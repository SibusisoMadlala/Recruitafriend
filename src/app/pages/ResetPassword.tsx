import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Lock, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    // Supabase appends the recovery token in the URL hash after the redirect
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) {
      setTokenError(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success('Password updated! Please sign in with your new password.');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)] py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[var(--rf-navy)]">Invalid or Expired Link</h2>
            <p className="text-[var(--rf-muted)]">
              This link is invalid or has expired. Please request a new password reset.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[var(--rf-green-hover,#00B548)] transition-colors"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)] py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--rf-green)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-[var(--rf-green)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Set New Password</h2>
            <p className="text-[var(--rf-muted)] mt-2">Enter your new password below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                placeholder="Repeat your password"
              />
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-red-500 text-sm">Passwords do not match</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[var(--rf-green-hover,#00B548)] transition-colors font-semibold disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
