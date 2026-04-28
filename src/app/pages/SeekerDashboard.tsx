import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { apiCall } from '../lib/supabase';
import type { Application, Job } from '../types';
import { resolveAppCompanyName, resolveCompanyName } from '../lib/companyDisplay';
import {
  ClipboardList, Eye, Heart, DollarSign, Briefcase, Loader2, Video, Calendar, ArrowRight
} from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function SeekerDashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [recommendedStart, setRecommendedStart] = useState(0);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [stats, setStats] = useState({
    applicationsSent: 0,
    profileViews: 0,
    savedJobs: 0,
    referralEarnings: 0,
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  async function loadDashboardData() {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const [appsRes, savedRes, viewsRes, jobsRes] = await Promise.allSettled([
        apiCall('/applications/my', { requireAuth: true }),
        apiCall('/saved-jobs/count', { requireAuth: true }),
        apiCall('/profile/views', { requireAuth: true }),
        apiCall('/jobs?limit=12&page=1'),
      ]);

      const appRows = (appsRes.status === 'fulfilled' ? (appsRes.value.applications || []) : []) as Application[];
      const jobRows = (jobsRes.status === 'fulfilled' ? (jobsRes.value.jobs || []) : []) as Job[];
      const savedCount = savedRes.status === 'fulfilled' ? savedRes.value.count : 0;
      const profileViewCount = viewsRes.status === 'fulfilled' ? viewsRes.value.views : 0;

      const hasCoreFailure = [appsRes, savedRes, viewsRes].some((r) => r.status === 'rejected');

      setApplications(appRows.slice(0, 5));
      setRecommendedJobs(jobRows);
      setStats({
        applicationsSent: appRows.length,
        profileViews: profileViewCount ?? 0,
        savedJobs: savedCount ?? 0,
        referralEarnings: 0,
      });

      if (hasCoreFailure) {
        setDashboardError('Some dashboard data could not be loaded. Showing available data.');
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setDashboardError('Could not load all dashboard data. Some widgets may be incomplete.');
    } finally {
      setDashboardLoading(false);
    }
  }

  const upcomingInterviews = useMemo(() => {
    return applications
      .filter((app) => app.status === 'interview')
      .map((app) => ({
        id: app.id,
        role: app.job_title || 'Interview',
        company: resolveAppCompanyName(app),
        date: 'Check your email for schedule',
      }));
  }, [applications]);

  const visibleRecommendedJobs = useMemo(() => {
    return recommendedJobs.slice(recommendedStart, recommendedStart + 3);
  }, [recommendedJobs, recommendedStart]);

  const canGoPrev = recommendedStart > 0;
  const canGoNext = recommendedStart + 3 < recommendedJobs.length;


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--rf-bg)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--rf-green)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[var(--rf-navy)] to-[#1a3a5f] text-white rounded-[var(--rf-radius-lg)] p-8 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">{getGreeting()}, {profile?.name?.split(' ')[0] || 'User'}!</h2>
            <p className="opacity-90 max-w-xl">
            You have <span className="font-bold text-[var(--rf-green)]">{stats.profileViews} new profile views</span> this week. Complete your profile to get more visibility.
            </p>
            <Link to="/seeker/profile" className="inline-block mt-6 px-6 py-2 bg-[var(--rf-green)] text-white font-semibold rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors shadow-md">
                Complete Profile
            </Link>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
            <Briefcase className="w-64 h-64" />
        </div>
      </div>

      {dashboardError && (
        <div className="rounded-[var(--rf-radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {dashboardError}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Applications Sent', value: stats.applicationsSent, icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Profile Views', value: stats.profileViews, icon: Eye, color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Saved Jobs', value: stats.savedJobs, icon: Heart, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Referral Earnings', value: `R${stats.referralEarnings}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((stat, index) => (
            <div key={index} className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 hover:-translate-y-1 transition-transform duration-200">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-full ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
            </div>
            <div className="text-3xl font-bold text-[var(--rf-navy)] mb-1">{stat.value}</div>
            <div className="text-sm text-[var(--rf-muted)]">{stat.label}</div>
            </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Application Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-[var(--rf-navy)]">Application Pipeline</h3>
            <Link to="/seeker/applications" className="text-sm font-semibold text-[var(--rf-green)] hover:underline flex items-center">
                View All <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          <div className="flex justify-between items-center relative">
            {/* Pipeline Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-0 rounded-full"></div>
            
            {['Applied', 'Viewed', 'Shortlisted', 'Interview', 'Offer'].map((stage, index) => {
                const count = applications.filter(app => app.status === stage.toLowerCase()).length;
                const active = count > 0;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => navigate(`/seeker/applications?status=${stage.toLowerCase()}`)}
                    className="relative z-10 flex flex-col items-center group cursor-pointer"
                  >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-3 border-4 transition-colors ${active ? 'bg-[var(--rf-navy)] border-[var(--rf-green)] text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>
                            {count}
                        </div>
                        <span className={`text-xs font-semibold ${active ? 'text-[var(--rf-navy)]' : 'text-gray-400'}`}>{stage}</span>
                  </button>
                );
            })}
          </div>
          
          <div className="mt-8">
            <h4 className="font-bold text-[var(--rf-navy)] mb-3 text-sm uppercase tracking-wide opacity-70">Recent Activity</h4>
            <div className="space-y-3">
                {applications.length > 0 ? applications.map((app, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-[var(--rf-radius-md)] border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-white rounded flex items-center justify-center font-bold text-gray-700 shadow-sm mr-3">
                                {resolveAppCompanyName(app).charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h5 className="font-semibold text-[var(--rf-navy)] text-sm">{app.job_title}</h5>
                                <p className="text-xs text-[var(--rf-muted)]">{resolveAppCompanyName(app)} • Applied 2 days ago</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                            {app.status}
                        </span>
                    </div>
                )) : (
                    <p className="text-sm text-gray-500 italic">No recent applications.</p>
                )}
            </div>
          </div>
        </div>

        {/* Upcoming Interviews Widget */}
        <div className="lg:col-span-1 bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 border-t-4 border-[var(--rf-green)]">
           <h3 className="text-xl font-bold text-[var(--rf-navy)] mb-4 flex items-center">
             <Video className="w-5 h-5 mr-2 text-[var(--rf-green)]" />
             Upcoming Interviews
           </h3>
           <div className="space-y-4">
             {upcomingInterviews.length > 0 ? upcomingInterviews.map((interview) => (
               <div key={interview.id} className="p-4 bg-gray-50 rounded-[var(--rf-radius-md)] border border-gray-100 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-[var(--rf-navy)]"></div>
                 <div className="mb-2">
                    <h4 className="font-bold text-[var(--rf-navy)]">{interview.role}</h4>
                    <p className="text-sm text-[var(--rf-muted)]">{interview.company}</p>
                 </div>
                 <div className="flex items-center text-xs text-gray-500 mb-3 font-medium">
                    <Calendar className="w-3 h-3 mr-1" />
                    {interview.date}
                 </div>
                  <button disabled className="w-full py-2 bg-gray-200 text-gray-500 text-xs font-bold rounded cursor-not-allowed" title="Waiting room opens when schedule and link are available">
                    Join Waiting Room
                 </button>
               </div>
             )) : (
                <div className="text-center py-8 text-gray-400">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming interviews</p>
                </div>
             )}
           </div>
        </div>
      </div>
      
      {/* Recommended Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-[var(--rf-navy)]">Recommended For You</h3>
             <div className="flex space-x-2">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => setRecommendedStart((v) => Math.max(0, v - 3))}
                className={`p-2 rounded-full bg-white shadow-sm ${canGoPrev ? 'hover:bg-gray-50 text-[var(--rf-navy)]' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setRecommendedStart((v) => v + 3)}
                className={`p-2 rounded-full bg-white shadow-sm ${canGoNext ? 'hover:bg-gray-50 text-[var(--rf-navy)]' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
             </div>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
            {dashboardLoading ? (
              <div className="w-full text-center py-12 bg-white rounded-[var(--rf-radius-lg)] border border-dashed border-gray-300">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--rf-green)]" />
                <p className="text-gray-500">Loading recommendations...</p>
              </div>
            ) : visibleRecommendedJobs.length > 0 ? visibleRecommendedJobs.map((job) => (
              <Link to={`/jobs/${job.id}`} key={job.id} className="min-w-[280px] bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 border border-transparent hover:border-[var(--rf-green)] transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-[var(--rf-navy)]">
                    {resolveCompanyName(job?.employer, job?.company || 'C').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-[var(--rf-green)] bg-green-50 px-2 py-1 rounded-full">
                    Recommended
                        </span>
                    </div>
                    <h4 className="font-bold text-[var(--rf-navy)] mb-1 group-hover:text-[var(--rf-green)] transition-colors">{job.title}</h4>
                <p className="text-sm text-gray-500 mb-3">{resolveCompanyName(job?.employer, job?.company || 'Company')}</p>
                    <div className="flex items-center text-xs text-gray-400 mb-4">
                  {[job.city, job.province].filter(Boolean).join(', ') || 'South Africa'}
                    </div>
               </Link>
            )) : (
                <div className="w-full text-center py-12 bg-white rounded-[var(--rf-radius-lg)] border border-dashed border-gray-300">
                    <p className="text-gray-500">No recommended jobs found at this time.</p>
                    <Link to="/jobs" className="text-[var(--rf-green)] font-bold text-sm hover:underline mt-2 inline-block">
                        Browse all jobs
                    </Link>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
