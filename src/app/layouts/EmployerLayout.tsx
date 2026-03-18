import { Outlet } from 'react-router';
import { useAuth } from '../context/useAuth';
import { EmployerSidebar } from '../components/EmployerSidebar';
import { Navbar } from '../components/Navbar';
import { Loader2 } from 'lucide-react';

export default function EmployerLayout() {
  const { loading } = useAuth();
  
  if (loading) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
       </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-gray-50">
      <EmployerSidebar />
      <div className="flex min-w-0 flex-1 flex-col pt-16 transition-all duration-300 md:ml-64 md:pt-0 min-h-screen">
          <Navbar />
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
      </div>
    </div>
  );
}
