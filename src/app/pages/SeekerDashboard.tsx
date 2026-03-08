import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/supabase';
import {
  LayoutDashboard, User, FileText, Bell, Briefcase, ClipboardList,
  Video, Users, Gift, Star, Settings, LogOut, TrendingUp, Eye, Heart, DollarSign
} from 'lucide-react';

export default function SeekerDashboard() {
  const { user, profile, signOut } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [stats, setStats] = useState({
    applicationsSent: 0,
    profileViews: 0,
    savedJobs: 0,
    referralEarnings: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const { applications: apps } = await apiCall('/applications/my');
      setApplications(apps.slice(0, 5));
      
      setStats({
        applicationsSent: apps.length,
        profileViews: Math.floor(Math.random() * 50) + 10,
        savedJobs: Math.floor(Math.random() * 20) + 5,
        referralEarnings: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  const getStatusColor = (status: string) => {
    const colors: any = {
      applied: 'bg-[var(--rf-status-applied)]',
      viewed: 'bg-[var(--rf-status-viewed)]',
      shortlisted: 'bg-[var(--rf-status-shortlisted)]',
      interview: 'bg-[var(--rf-status-interview)]',
      offer: 'bg-[var(--rf-status-offer)]',
      rejected: 'bg-[var(--rf-status-rejected)]',
    };
    return colors[status] || 'bg-gray-500';
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/seeker/dashboard', active: true },
    { icon: User, label: 'My Profile', path: '/seeker/profile' },
    { icon: FileText, label: 'My CV', path: '/seeker/profile' },
    { icon: Bell, label: 'Job Alerts', path: '/seeker/dashboard' },
    { icon: Heart, label: 'Saved Jobs', path: '/seeker/dashboard' },
    { icon: ClipboardList, label: 'My Applications', path: '/seeker/dashboard' },
    { icon: Video, label: 'Video Interviews', path: '/seeker/interviews' },
    { icon: Users, label: 'My Network', path: '/seeker/network' },
    { icon: Gift, label: 'Referrals', path: '/seeker/network' },
    { icon: Star, label: 'Subscription', path: '/seeker/subscriptions' },
    { icon: Settings, label: 'Settings', path: '/seeker/dashboard' },
  ];

  return (
    <div className="flex min-h-screen bg-[var(--rf-bg)]">
      {/* Sidebar */}
      <div className="w-64 bg-[var(--rf-navy)] text-white flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--rf-green)] text-white font-bold text-2xl mb-3 mx-auto">
            {profile?.name?.charAt(0) || 'U'}
          </div>
          <div className="text-center mb-6">
            <h3 className="font-semibold mb-1">Hi, {profile?.name?.split(' ')[0] || 'User'} 👋</h3>
            <div className="flex items-center justify-center mt-2">
              <div className="relative w-16 h-16">
                <svg className="transform -rotate-90 w-16 h-16">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="var(--rf-green)"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${65 * 1.76} ${100 * 1.76}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  65%
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-1">Profile Complete</p>
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
          <button
            onClick={() => signOut()}
            className="flex items-center space-x-3 px-4 py-3 rounded-[var(--rf-radius-md)] mb-1 text-gray-300 hover:bg-white hover:bg-opacity-10 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Logout</span>
          </button>
        </nav>

        <div className="px-6 py-4 mt-6 border-t border-white border-opacity-10">
          <div className="px-3 py-2 bg-[var(--rf-green)] bg-opacity-20 rounded-[var(--rf-radius-md)] text-center">
            <span className="text-xs font-semibold">FREE PLAN</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[var(--rf-orange)] to-[#FF8B5C] text-white rounded-[var(--rf-radius-lg)] p-6 mb-8 shadow-[var(--rf-card-shadow)]">
          <h2 className="text-2xl font-bold mb-2">Good morning, {profile?.name?.split(' ')[0] || 'User'}! 👋</h2>
          <p>
            You have {stats.profileViews} new profile views and your profile is 65% complete.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Applications Sent</span>
              <ClipboardList className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.applicationsSent}</div>
            <div className="text-xs text-[var(--rf-success)] flex items-center mt-2">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12% this week
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Profile Views</span>
              <Eye className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.profileViews}</div>
            <div className="text-xs text-[var(--rf-success)] flex items-center mt-2">
              <TrendingUp className="w-3 h-3 mr-1" />
              +8% this week
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Saved Jobs</span>
              <Heart className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.savedJobs}</div>
            <div className="text-xs text-[var(--rf-muted)] mt-2">
              View saved →
            </div>
          </div>

          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--rf-muted)] text-sm">Referral Earnings</span>
              <DollarSign className="w-5 h-5 text-[var(--rf-green)]" />
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)]">R{stats.referralEarnings}</div>
            <div className="text-xs text-[var(--rf-muted)] mt-2">
              Start earning →
            </div>
          </div>
        </div>

        {/* Application Pipeline */}
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 mb-8">
          <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Application Pipeline</h3>
          <div className="grid grid-cols-5 gap-4">
            {['Applied', 'Viewed', 'Shortlisted', 'Interview', 'Offer'].map((stage, index) => (
              <div key={stage} className="text-center">
                <div className="bg-gray-100 rounded-[var(--rf-radius-md)] p-4 mb-2">
                  <div className="text-2xl font-bold text-[var(--rf-navy)]">
                    {applications.filter(app => app.status === stage.toLowerCase()).length}
                  </div>
                </div>
                <div className="text-sm text-[var(--rf-muted)]">{stage}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[var(--rf-navy)]">My Recent Applications</h3>
            <Link to="/jobs" className="text-[var(--rf-green)] hover:underline text-sm font-semibold">
              View All →
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-[var(--rf-muted)] mx-auto mb-4" />
              <p className="text-[var(--rf-muted)] mb-4">You haven't applied to any jobs yet</p>
              <Link
                to="/jobs"
                className="inline-block px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors"
              >
                Browse Jobs
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[var(--rf-border)]">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Job Title</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Date Applied</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--rf-text)]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-b border-[var(--rf-border)] hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <Link to={`/jobs/${app.jobId}`} className="font-semibold text-[var(--rf-navy)] hover:text-[var(--rf-green)]">
                          {app.job?.title || 'Job Title'}
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-[var(--rf-muted)]">
                        {app.job?.company || 'Company Name'}
                      </td>
                      <td className="py-4 px-4 text-[var(--rf-muted)] text-sm">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-[var(--rf-radius-pill)] text-white text-xs font-semibold ${getStatusColor(app.status)}`}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          to={`/jobs/${app.jobId}`}
                          className="text-[var(--rf-green)] hover:underline text-sm"
                        >
                          View Job
                        </Link>
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
