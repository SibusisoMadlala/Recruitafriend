import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../context/useAuth';
import { LayoutDashboard, ClipboardList, Newspaper, LogOut, Menu, X } from 'lucide-react';

interface AdminSidebarProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  showMobileToggle?: boolean;
}

export function AdminSidebar({ isOpen: controlledIsOpen, onOpenChange, showMobileToggle = true }: AdminSidebarProps = {}) {
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
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Admin Dashboard', path: '/admin/dashboard' },
    { icon: ClipboardList, label: 'Onboarding Queue', path: '/admin/onboarding' },
    { icon: Newspaper, label: 'Community Blogs', path: '/admin/community/blogs' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {showMobileToggle && (
        <button
          aria-label={isOpen ? 'Close admin navigation' : 'Open admin navigation'}
          aria-expanded={isOpen}
          className="fixed left-4 top-3 z-50 rounded-md bg-[#0A2540] p-2 text-white shadow-lg md:hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 max-w-[86vw] bg-[#0A2540] text-white transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        flex flex-col shadow-xl md:shadow-none
      `}>
        <div className="border-b border-gray-700 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#00C853]">Admin Console</p>
          <h2 className="mt-2 truncate text-lg font-bold">{profile?.name || 'Operations Admin'}</h2>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto py-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`
                relative flex items-center px-6 py-3 transition-colors
                ${isActive(item.path) ? 'bg-[#113052] text-[#00C853]' : 'text-gray-300 hover:bg-[#113052] hover:text-white'}
              `}
            >
              {isActive(item.path) && <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#00C853]" />}
              <item.icon className="mr-3 h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}

          <button
            onClick={() => signOut()}
            className="mt-4 flex w-full items-center px-6 py-3 text-gray-300 transition-colors hover:bg-[#113052] hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span className="font-medium">Logout</span>
          </button>
        </nav>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
