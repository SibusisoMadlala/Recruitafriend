import { Link, Outlet, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { calculateProfileCompletion } from '../lib/profileCompletion';
import {
  LayoutDashboard, User, FileText, Bell, Briefcase, ClipboardList,
  Video, Users, Gift, Star, Settings, LogOut, Loader2, Heart, Edit3
} from 'lucide-react';

export default function SeekerLayout() {
  const { profile, loading, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/seeker/dashboard' },
    { icon: User, label: 'My Profile', path: '/seeker/profile' },
    { icon: FileText, label: 'My CV', path: '/seeker/cv' },
    { icon: Bell, label: 'Job Alerts', path: '/seeker/alerts' },
    { icon: Heart, label: 'Saved Jobs', path: '/seeker/saved' },
    { icon: ClipboardList, label: 'My Applications', path: '/seeker/applications' },
    { icon: Video, label: 'Video Interviews', path: '/seeker/interviews' },
    { icon: Users, label: 'My Network', path: '/seeker/network' },
    { icon: Star, label: 'Subscription', path: '/seeker/subscriptions' },
  ];

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

  return (
    <div className="flex min-h-screen bg-[var(--rf-bg)]">
      {/* Sidebar */}
      <div className="w-72 bg-[var(--rf-navy)] text-white flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto">
        <div className="p-8 flex flex-col items-center">
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

        <nav className="flex-1 px-4 space-y-1">
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

        <div className="p-6 border-t border-white border-opacity-10 mt-auto">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-[var(--rf-radius-md)] p-4 text-center border border-gray-700">
             <span className="block text-xs text-gray-400 uppercase tracking-widest mb-1">Current Plan</span>
             <span className="block text-lg font-bold text-white tracking-wider">{(profile?.subscription || 'Free').toUpperCase()} PLAN</span>
             <Link to="/seeker/subscriptions" className="block mt-3 text-xs text-[var(--rf-green)] font-bold hover:underline">
               {profile?.subscription && profile.subscription.toLowerCase() !== 'free' ? 'MANAGE PLAN' : 'UPGRADE NOW'}
             </Link>
          </div>
          
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center space-x-2 w-full mt-4 text-gray-500 hover:text-white transition-colors py-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto">
           <Outlet />
        </div>
      </div>
    </div>
  );
}
