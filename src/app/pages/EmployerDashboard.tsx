import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/supabase';
import {
  LayoutDashboard, PlusCircle, ClipboardList, Users, Video, Search,
  Building2, BarChart3, Star, Settings, TrendingUp, Eye, FileText, DollarSign
} from 'lucide-react';

export default function EmployerDashboard() {
  const { profile, signOut } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeListings: 0,
    totalApplications: 0,
    shortlisted: 0,
    cvViews: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const { jobs: employerJobs } = await apiCall('/employer/jobs');
      setJobs(employerJobs.slice(0, 5));
      
      const activeCount = employerJobs.filter((j: any) => j.status === 'active').length;
      const totalApps = employerJobs.reduce((sum: number, j: any) => sum + (j.applications || 0), 0);
      
      setStats({
        activeListings: activeCount,
        totalApplications: totalApps,
        shortlisted: Math.floor(totalApps * 0.3),
        cvViews: Math.floor(Math.random() * 200) + 50,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/employer/dashboard', active: true },
    { icon: PlusCircle, label: 'Post a Job', path: '/employer/post-job' },
    { icon: ClipboardList, label: 'My Listings', path: '/employer/dashboard' },
    { icon: Users, label: 'Applicants', path: '/employer/dashboard' },
    { icon: Video, label: 'Video Interviews', path: '/employer/dashboard' },
    { icon: Search, label: 'Talent Search', path: '/employer/talent-search' },
    { icon: Building2, label: 'Company Profile', path: '/employer/dashboard' },
    { icon: BarChart3, label: 'Analytics', path: '/employer/dashboard' },
    { icon: Star, label: 'Subscription', path: '/employer/subscriptions' },
    { icon: Settings, label: 'Settings', path: '/employer/dashboard' },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--rf-bg)]">
      {/* Sidebar */}
      <div className="w-64 bg-[var(--rf-navy)] text-white flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--rf-green)] text-white font-bold text-2xl mb-3 mx-auto">
            {profile?.name?.charAt(0) || 'C'}
          </div>
          <div className="text-center mb-6">
            <h3 className="font-semibold">{profile?.name || 'Company'}</h3>
            <p className="text-xs text-gray-300 mt-1">Employer Account</p>
          </div>
        </div>

        <nav className="px-3">
          {navItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-[var(--rf-radius-md)] mb-1 transition-colors ${
                item.active
                  ? 'bg-[var(--rf-green)] text-white'
                  : 'text-gray-300 hover:bg-white hover:bg-opacity-10'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-6 py-4 mt-6 border-t border-white border-opacity-10">
          <div className="px-3 py-2 bg-[var(--rf-green)] bg-opacity-20 rounded-[var(--rf-radius-md)] text-center">
            <span className="text-xs font-semibold">{profile?.subscription?.toUpperCase() || 'STARTER'}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[var(--rf-navy)] to-[#0d3a5f] text-white rounded-[var(--rf-radius-lg)] p-6 mb-8 shadow-[var(--rf-card-shadow)]">
          <h2 className="text-2xl font-bold mb-2">Welcome back, {profile?.name || 'Company'}! 👋</h2>
          <p>You have {stats.totalApplications} new applications across your active job listings.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Active Listings</span>
              <FileText className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.activeListings}</div>
            <div className="text-xs text-[var(--rf-muted)] mt-2">
              <Link to="/employer/post-job" className="text-[var(--rf-green)] hover:underline">
                Post new job →
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Total Applications</span>
              <Users className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.totalApplications}</div>
            <div className="text-xs text-[var(--rf-success)] flex items-center mt-2">
              <TrendingUp className="w-3 h-3 mr-1" />
              +15% this week
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Shortlisted</span>
              <Star className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.shortlisted}</div>
            <div className="text-xs text-[var(--rf-muted)] mt-2">
              Candidates marked
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">CV Views</span>
              <Eye className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.cvViews}</div>
            <div className="text-xs text-[var(--rf-muted)] mt-2">
              This month
            </div>
          </div>
        </div>

        {/* Active Listings */}
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--rf-navy)]">Active Job Listings</h3>
            <Link
              to="/employer/post-job"
              className="px-4 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors text-sm font-semibold"
            >
              <PlusCircle className="w-4 h-4 inline mr-2" />
              Post New Job
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-[var(--rf-muted)] mx-auto mb-4" />
              <p className="text-[var(--rf-muted)] mb-4">You don't have any active job listings yet</p>
              <Link
                to="/employer/post-job"
                className="inline-block px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors"
              >
                Post Your First Job
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[var(--rf-border)]">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Job Title</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Applications</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Views</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-[var(--rf-border)] hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-[var(--rf-navy)]">{job.title}</div>
                        <div className="text-xs text-[var(--rf-muted)]">
                          Posted {new Date(job.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[var(--rf-navy)] font-semibold">{job.applications || 0}</span>
                      </td>
                      <td className="py-4 px-4 text-[var(--rf-muted)]">
                        {job.views || 0}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-[var(--rf-radius-pill)] text-xs font-semibold bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)]">
                          {job.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <Link
                            to={`/employer/applicants/${job.id}`}
                            className="text-[var(--rf-green)] hover:underline text-sm"
                          >
                            View Applicants
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
