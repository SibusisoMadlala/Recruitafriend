import { useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Always show success to avoid user enumeration
      setSent(true);
      toast.success('Check your inbox for a reset link');
    } catch (error) {
      // Still show success message for security
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)] py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--rf-green)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-[var(--rf-green)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Forgot Password?</h2>
            <p className="text-[var(--rf-muted)] mt-2">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-[var(--rf-radius-md)] text-green-700">
                If an account with that email exists, a password reset link has been sent to your inbox.
              </div>
              <Link
                to="/login"
                className="inline-flex items-center text-[var(--rf-green)] hover:underline font-semibold"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Login
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[var(--rf-green-hover,#00B548)] transition-colors font-semibold disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm text-[var(--rf-muted)] hover:text-[var(--rf-green)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
