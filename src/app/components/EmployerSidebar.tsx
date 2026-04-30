import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Briefcase, 
  Users, 
  Video, 
  Search, 
  Building2, 
  BarChart2, 
  LogOut,
  Menu,
  X
} from 'lucide-react';

interface EmployerSidebarProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  showMobileToggle?: boolean;
}

export function EmployerSidebar({ isOpen: controlledIsOpen, onOpenChange, showMobileToggle = true }: EmployerSidebarProps = {}) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;

  const setIsOpen = (next: boolean) => {
    if (onOpenChange) {
      onOpenChange(next);
      return;
    }

    setUncontrolledIsOpen(next);
  };

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employer/dashboard' },
    { icon: PlusCircle, label: 'Post a Job', path: '/employer/post-job' },
    { icon: Briefcase, label: 'My Listings', path: '/employer/listings' },
    { icon: Users, label: 'Applicants', path: '/employer/applicants' },
    { icon: Video, label: 'Video Interviews', path: '/employer/interviews' },
    { icon: Search, label: 'Talent Search', path: '/employer/talent-search' },
    { icon: Building2, label: 'Company Profile', path: '/employer/profile' },
    { icon: BarChart2, label: 'Analytics', path: '/employer/analytics' },
  ];

  // Helper for Plan Badge Color
  const getBadgeColor = (plan: string) => {
    switch (plan) {
      case 'GROWTH': return 'bg-[#00C853] text-white';
      case 'PROFESSIONAL': return 'bg-[#0A2540] text-white';
      case 'ENTERPRISE': return 'bg-[#F59E0B] text-white';
      default: return 'bg-gray-500 text-white'; // STARTER
    }
  };

  const plan = profile?.subscription || 'STARTER';

  return (
    <>
      {/* Mobile Toggle */}
      {showMobileToggle && (
        <button 
          aria-label={isOpen ? 'Close employer navigation' : 'Open employer navigation'}
          aria-expanded={isOpen}
          className="fixed left-4 top-3 z-50 rounded-md bg-[#0A2540] p-2 text-white shadow-lg md:hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 max-w-[86vw] bg-[#0A2540] text-white transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:top-0 md:z-50 md:h-screen md:translate-x-0
        flex flex-col shadow-xl md:shadow-none
      `}>
        {/* Top Section */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
               {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Company logo" className="w-full h-full object-cover" />
               ) : (
                  <span className="text-[#00C853] font-bold text-lg">
                    {profile?.name ? profile.name.substring(0, 2).toUpperCase() : 'CO'}
                  </span>
               )}
            </div>
            <div>
              <h2 className="font-bold text-white leading-tight truncate max-w-[140px]">
                {profile?.name || 'Company Name'}
              </h2>
              <span className="text-[#00C853] text-[10px] uppercase font-semibold tracking-wider">
                EMPLOYER ACCOUNT
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`
                flex items-center px-6 py-3 transition-colors relative
                ${isActive(item.path) 
                  ? 'text-[#00C853] bg-[#113052]' 
                  : 'text-gray-300 hover:bg-[#113052] hover:text-white'}
              `}
            >
              {isActive(item.path) && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00C853]" />
              )}
              <item.icon className={`w-5 h-5 mr-3 ${isActive(item.path) ? 'text-[#00C853]' : ''}`} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
          
          <button
            onClick={() => signOut()}
            className="w-full flex items-center px-6 py-3 text-gray-300 hover:bg-[#113052] hover:text-white transition-colors mt-4"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-medium">Logout</span>
          </button>
        </nav>

        {/* Bottom Plan Badge */}
        
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
