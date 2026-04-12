import { Link, useSearchParams } from 'react-router';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--rf-bg)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 sm:p-8">
          <div className="text-center">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="text-2xl font-bold text-[var(--rf-navy)] sm:text-3xl">Recruit</span>
              <span className="text-2xl font-bold text-[var(--rf-green)] sm:text-3xl">Friend</span>
            </div>

            <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Verify your email</h2>
            <p className="mt-3 text-[var(--rf-muted)]">
              Your account was created successfully. Please check your email and click the verification link before signing in.
            </p>

            {email && (
              <p className="mt-3 text-sm text-[var(--rf-text)]">
                Verification email sent to <span className="font-semibold">{email}</span>
              </p>
            )}

            <div className="mt-8 space-y-3">
              <Link
                to="/login"
                className="block w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold"
              >
                Back to Sign In
              </Link>
              <Link
                to="/signup"
                className="block w-full py-3 border border-[var(--rf-border)] text-[var(--rf-text)] rounded-[var(--rf-radius-md)] hover:bg-gray-50 transition-colors font-semibold"
              >
                Create another account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}