import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { LogOut, Menu, X } from 'lucide-react';

interface NavbarProps {
  hideMobileMenuToggle?: boolean;
  fullWidth?: boolean;
  className?: string;
  mobileLeading?: ReactNode;
}

export function Navbar({ hideMobileMenuToggle = false, fullWidth = false, className = '', mobileLeading }: NavbarProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole = String(profile?.userType || (profile as Record<string, unknown> | null)?.user_type || user?.user_metadata?.userType || '').toLowerCase();

  const dashboardPath =
    userRole === 'admin'
      ? '/admin/dashboard'
      : userRole === 'employer'
      ? '/employer/dashboard'
      : '/seeker/dashboard';

  const homePath = userRole === 'seeker' ? '/seeker/dashboard' : userRole === 'admin' ? '/admin/dashboard' : '/';

  const navItems = useMemo(
    () => [
      { to: '/community', label: 'Community' },
      ...(user ? [{ to: dashboardPath, label: 'Dashboard' }] : []),
    ],
    [dashboardPath, user],
  );

  useEffect(() => {
    if (hideMobileMenuToggle && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [hideMobileMenuToggle, isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    setIsMobileMenuOpen(false);
    await signOut();
    navigate('/');
  };

  return (
    <nav className={`sticky top-0 z-50 bg-white shadow-[var(--rf-nav-shadow)] ${className}`}>
      <div className={`${fullWidth ? 'w-full' : 'max-w-7xl mx-auto'} px-4 sm:px-6 lg:px-8`}>
        <div className="flex items-center justify-between h-16">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {mobileLeading && <div className="md:hidden">{mobileLeading}</div>}

            {/* Logo */}
            <Link to={homePath} className="flex min-w-0 items-center space-x-2" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="flex items-center">
                <span className="text-xl font-bold text-[var(--rf-navy)] sm:text-2xl">Recruit</span>
                <span className="text-xl font-bold text-[var(--rf-green)] sm:text-2xl">Friend</span>
              </div>
            </Link>
          </div>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[var(--rf-text)] hover:text-[var(--rf-green)] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            {user ? (
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            ) : (
              <>
                <Link 
                  to="/login"
                  className="px-4 py-2 text-[var(--rf-text)] hover:text-[var(--rf-green)] transition-colors"
                >
                  Login
                </Link>
                <Link 
                  to="/signup"
                  className="px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-pill)] hover:bg-[#00B548] transition-colors shadow-[var(--rf-card-shadow)]"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {!hideMobileMenuToggle && (
            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              className="inline-flex items-center justify-center rounded-[var(--rf-radius-md)] p-2 text-[var(--rf-navy)] transition-colors hover:bg-gray-100 md:hidden"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {!hideMobileMenuToggle && isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 top-16 z-40 bg-[rgba(10,37,64,0.45)] md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-x-0 top-16 z-50 border-t border-gray-100 bg-white shadow-lg md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-[var(--rf-radius-md)] px-3 py-3 text-[var(--rf-text)] transition-colors hover:bg-gray-50 hover:text-[var(--rf-green)]"
                >
                  {item.label}
                </Link>
              ))}

              <div className="mt-2 border-t border-gray-100 pt-3">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center justify-center space-x-2 rounded-[var(--rf-radius-md)] border border-gray-200 px-4 py-3 text-[var(--rf-text)] transition-colors hover:bg-gray-50"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="rounded-[var(--rf-radius-md)] border border-gray-200 px-4 py-3 text-center text-[var(--rf-text)] transition-colors hover:bg-gray-50"
                    >
                      Login
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="rounded-[var(--rf-radius-pill)] bg-[var(--rf-green)] px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-[#00B548]"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
