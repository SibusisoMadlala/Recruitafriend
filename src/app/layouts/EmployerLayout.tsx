import { useState } from 'react';
import { Outlet } from 'react-router';
import { useAuth } from '../context/useAuth';
import { EmployerSidebar } from '../components/EmployerSidebar';
import { Navbar } from '../components/Navbar';
import { Loader2, Menu, X } from 'lucide-react';

export default function EmployerLayout() {
  const { loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  if (loading) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
       </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-gray-50">
      <EmployerSidebar isOpen={isSidebarOpen} onOpenChange={setIsSidebarOpen} showMobileToggle={false} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 md:ml-64">
          <Navbar
            hideMobileMenuToggle
            fullWidth
            className="z-30"
            mobileLeading={(
              <button
                type="button"
                aria-label={isSidebarOpen ? 'Close employer navigation' : 'Open employer navigation'}
                aria-expanded={isSidebarOpen}
                className="inline-flex items-center justify-center rounded-[var(--rf-radius-md)] border border-gray-200 p-2 text-[var(--rf-navy)] transition-colors hover:bg-gray-50 md:hidden"
                onClick={() => setIsSidebarOpen((open) => !open)}
              >
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          />
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
      </div>
    </div>
  );
}
