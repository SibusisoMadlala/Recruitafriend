import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { calculateProfileCompletion } from '../lib/profileCompletion';
import {
  LayoutDashboard, User, FileText, Briefcase, ClipboardList,
  Video, Users, LogOut, Loader2, Heart, Edit3, Menu, X
} from 'lucide-react';

export default function SeekerLayout() {
  const { profile, loading, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/seeker/dashboard' },
      { icon: User, label: 'My Profile', path: '/seeker/profile' },
      { icon: FileText, label: 'My CV', path: '/seeker/cv' },
      { icon: Heart, label: 'Saved Jobs', path: '/seeker/saved' },
      { icon: ClipboardList, label: 'My Applications', path: '/seeker/applications' },
      { icon: Video, label: 'Video Interviews', path: '/seeker/interviews' },
      { icon: Users, label: 'My Network', path: '/seeker/network' },
    ],
    [],
  );

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-[var(--rf-bg)]">
         <Loader2 className="w-8 h-8 animate-spin text-[var(--rf-green)]" />
       </div>
     );
  }

  // Calculate circumference for progress ring (r=36 -> C=2*pi*36 ≈ 226)
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const percent = calculateProfileCompletion(profile as any);
  const offset = circumference - (percent / 100) * circumference;

  const sidebarContent = (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rf-green)]">RecruitFriend</p>
          <p className="text-sm text-white/70">Seeker workspace</p>
        </div>
        <button
          type="button"
          aria-label="Close seeker navigation"
          className="rounded-[var(--rf-radius-md)] p-2 text-white transition-colors hover:bg-white/10"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6 md:p-8 flex flex-col items-center">
        {/* Profile Photo with Progress Ring */}
        <Link to="/seeker/profile" className="relative w-24 h-24 mb-4 group cursor-pointer">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="var(--rf-green)"
              strokeWidth="3"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-[6px] rounded-full overflow-hidden border-2 border-[var(--rf-navy)]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[var(--rf-green)] flex items-center justify-center text-2xl font-bold">
                {profile?.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 right-0 bg-white text-[var(--rf-navy)] p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit3 className="w-3 h-3" />
          </div>
        </Link>

        <div className="text-center">
          <h3 className="font-bold text-lg leading-tight mb-1">{profile?.name || 'User'}</h3>
          <p className="text-xs text-[var(--rf-green)] font-semibold">{percent}% Complete</p>
        </div>
      </div>

      <nav className="flex-1 px-3 pb-4 md:px-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-3 px-4 py-3 rounded-[var(--rf-radius-md)] transition-all ${
              location.pathname === item.path
                ? 'bg-[var(--rf-green)] text-white font-semibold shadow-md'
                : 'text-gray-400 hover:bg-white hover:bg-opacity-5 hover:text-white'
            }`}
          >
            <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-white' : 'text-gray-400'}`} />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-5 md:p-6 border-t border-white border-opacity-10 mt-auto">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-[var(--rf-radius-md)] p-4 text-center border border-gray-700">
          <span className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Current Plan</span>
          <span className="block text-lg font-bold text-white tracking-wider">{(profile?.subscription || 'Free').toUpperCase()} PLAN</span>
          <Link to="/seeker/subscriptions" className="block mt-3 text-xs text-[var(--rf-green)] font-bold hover:underline">
            {profile?.subscription && profile.subscription.toLowerCase() !== 'free' ? 'MANAGE PLAN' : 'UPGRADE NOW'}
          </Link>
        </div>

        <button
          onClick={() => signOut()}
          className="flex items-center justify-center space-x-2 w-full mt-4 text-gray-400 hover:text-white transition-colors py-2"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--rf-bg)] md:flex md:items-stretch">
      <aside className="hidden w-72 flex-shrink-0 flex-col self-stretch bg-[var(--rf-navy)] text-white md:flex md:min-h-screen">
        {sidebarContent}
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-[rgba(10,37,64,0.45)] md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col overflow-y-auto bg-[var(--rf-navy)] text-white shadow-xl transition-transform duration-300 md:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col bg-gray-50 md:min-h-screen">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:hidden">
          <button
            type="button"
            aria-label="Open seeker navigation"
            aria-expanded={isSidebarOpen}
            className="rounded-[var(--rf-radius-md)] border border-gray-200 p-2 text-[var(--rf-navy)] transition-colors hover:bg-gray-50"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 px-3 text-center">
            <p className="truncate text-sm font-semibold text-[var(--rf-navy)]">{profile?.name || 'User'}</p>
            <p className="text-xs font-medium text-[var(--rf-green)]">{percent}% profile complete</p>
          </div>

          <Link
            to="/seeker/profile"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--rf-green)] text-sm font-semibold text-white"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              profile?.name?.charAt(0) || 'U'
            )}
          </Link>
        </div>

        <div className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
