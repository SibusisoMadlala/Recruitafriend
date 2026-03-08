import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Users, Building2, LogOut, LayoutDashboard } from 'lucide-react';

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-[var(--rf-nav-shadow)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-[var(--rf-navy)]">Recruit</span>
              <span className="text-2xl font-bold text-[var(--rf-green)]">Friend</span>
            </div>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/jobs" className="text-[var(--rf-text)] hover:text-[var(--rf-green)] transition-colors">
              Find Jobs
            </Link>
            <Link to="/employer/talent-search" className="text-[var(--rf-text)] hover:text-[var(--rf-green)] transition-colors">
              Browse Companies
            </Link>
            <Link to="/employer/post-job" className="text-[var(--rf-text)] hover:text-[var(--rf-green)] transition-colors">
              For Employers
            </Link>
            <Link to="/seeker/network" className="text-[var(--rf-text)] hover:text-[var(--rf-green)] transition-colors">
              Community
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {user && profile ? (
              <>
                <Link 
                  to={profile.userType === 'seeker' ? '/seeker/dashboard' : '/employer/dashboard'}
                  className="flex items-center space-x-2 px-4 py-2 rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="hidden md:inline">Dashboard</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-4 py-2 rounded-[var(--rf-radius-md)] hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </>
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
        </div>
      </div>
    </nav>
  );
}
