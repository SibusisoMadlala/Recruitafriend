import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { 
  PlusCircle, Search, BarChart2, Edit, Eye, MoreHorizontal, 
  Clock, CheckCircle, Calendar, MessageSquare, Briefcase, Video
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { apiCall } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';

export default function EmployerDashboard() {
  const { profile } = useAuth();
  const companyName = profile?.name || 'Company';

  const [statsData, setStatsData] = useState({
    activeListings: 0,
    totalApplications: 0,
    shortlisted: 0,
    interviewsToday: 0,
    cvViews: 0,
  });
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentApplicants, setRecentApplicants] = useState<any[]>([]);
  const [todaysInterviews, setTodaysInterviews] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [{ activeListings: count, totalApplications, shortlisted, interviewsToday, cvViews }, { jobs }] = await Promise.all([
          apiCall('/employer/stats'),
          apiCall('/employer/jobs'),
        ]);
        setStatsData({ activeListings: count, totalApplications, shortlisted, interviewsToday, cvViews });
        const allJobs: any[] = jobs || [];
        setActiveListings(allJobs.filter((j: any) => j.status === 'active' && j.is_visible === true).slice(0, 5));

        // Load recent applicants from the first job with applications
        const jobWithApps = allJobs.find((j: any) => (j.apps ?? 0) > 0);
        if (jobWithApps) {
          try {
            const { applications } = await apiCall(`/jobs/${jobWithApps.id}/applications`, { requireAuth: true });
            setRecentApplicants((applications || []).slice(0, 4));
          } catch { /* non-critical */ }
        }

        // Load today's scheduled interviews across all active jobs
        const today = new Date().toDateString();
        const RF_INTERVIEW = 'RF_INTERVIEW:';
        const interviewJobs = allJobs.filter((j: any) => (j.apps ?? 0) > 0).slice(0, 5);
        const appsArrays = await Promise.all(
          interviewJobs.map((j: any) =>
            apiCall(`/jobs/${j.id}/applications`, { requireAuth: true })
              .then(({ applications }) => (applications || []).map((a: any) => ({ ...a, job_title: j.title })))
              .catch(() => [])
          )
        );
        const todayInterviews = appsArrays.flat().filter((a: any) => {
          if (a.status !== 'interview' || !a.notes?.startsWith(RF_INTERVIEW)) return false;
          try {
            const meta = JSON.parse(a.notes.slice(RF_INTERVIEW.length));
            return meta?.scheduled_at && new Date(meta.scheduled_at).toDateString() === today;
          } catch { return false; }
        });
        setTodaysInterviews(todayInterviews);
      } catch (err) {
        console.error('Failed to load employer dashboard data:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    loadData();
  }, []);

  const stats = [
    { label: 'Active Listings',       value: statsLoading ? '...' : String(statsData.activeListings),    icon: Briefcase },
    { label: 'Total Applications',    value: statsLoading ? '...' : String(statsData.totalApplications), icon: CheckCircle },
    { label: 'Shortlisted Candidates',value: statsLoading ? '...' : String(statsData.shortlisted),       icon: MessageSquare },
    { label: 'Interviews Today',      value: statsLoading ? '...' : String(statsData.interviewsToday),   icon: Video },
    { label: 'CV Views',              value: statsLoading ? '...' : String(statsData.cvViews),            icon: Eye },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0A2540] to-[#00C853] rounded-xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {companyName}!</h1>
        <p className="text-lg opacity-90">
          You have <span className="font-bold">{statsData.totalApplications} new applicants</span> and <span className="font-bold">{statsData.interviewsToday} interviews</span> scheduled today.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <div className="p-3 bg-blue-50 text-[#0A2540] rounded-full mb-3">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-[#0A2540]">{stat.value}</h3>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link to="/employer/post-job">
           <Button className="bg-[#00C853] hover:bg-[#00B548] text-white gap-2 h-12 px-6 text-base">
             <PlusCircle className="w-5 h-5" /> Post a New Job
           </Button>
        </Link>
        <Link to="/employer/talent-search">
           <Button className="bg-[#0A2540] hover:bg-[#081f36] text-white gap-2 h-12 px-6 text-base">
             <Search className="w-5 h-5" /> Search Candidates
           </Button>
        </Link>
        <Link to="/employer/analytics">
           <Button variant="outline" className="gap-2 h-12 px-6 text-base border-gray-300">
             <BarChart2 className="w-5 h-5" /> View Analytics
           </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Listings Table (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0A2540]">Active Listings</h2>
            <Link to="/employer/listings" className="text-[#00C853] font-medium hover:underline">View All Listings</Link>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              {activeListings.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold text-gray-700">Job Title</th>
                      <th className="p-4 font-semibold text-gray-700">Apps</th>
                      <th className="p-4 font-semibold text-gray-700">Views</th>
                      <th className="p-4 font-semibold text-gray-700">Status</th>
                      <th className="p-4 font-semibold text-gray-700 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeListings.map((job, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium text-[#0A2540]">{job.title}</td>
                        <td className="p-4">{job.apps ?? 0}</td>
                        <td className="p-4">{job.views ?? 0}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            job.status === 'active' ? 'bg-green-100 text-green-800' :
                            job.status === 'draft'  ? 'bg-gray-100 text-gray-700'   : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-[#0A2540]">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                   <Briefcase className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                   <p>No active job listings found.</p>
                   <Link to="/employer/post-job" className="text-[#00C853] hover:underline text-sm mt-2 inline-block">Post your first job</Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Applicants */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#0A2540]">Recent Applicants</h2>
              <Link to="/employer/applicants" className="text-[#00C853] font-medium hover:underline">View All Applicants</Link>
            </div>
            
            <div className="divide-y divide-gray-100 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[100px]">
              {recentApplicants.length > 0 ? (
                recentApplicants.map((app, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-[#0A2540] text-white text-xs">
                          {(app.seeker?.name || '??').split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-[#0A2540]">{app.seeker?.name || 'Candidate'}</p>
                        <p className="text-xs text-gray-500">{app.seeker?.headline || app.seeker?.email || ''} • {new Date(app.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Link to="/employer/applicants">
                      <Button variant="outline" size="sm" className="text-[#0A2540] border-gray-200">View</Button>
                    </Link>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                   <p>{statsLoading ? 'Loading...' : 'No recent applicants yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column Widgets */}
        <div className="space-y-8">
          
          {/* Today's Schedule */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#0A2540]">Today's Interviews</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-h-[100px] flex items-center justify-center">
               {todaysInterviews.length > 0 ? (
                 <div className="w-full divide-y divide-gray-100">
                   {todaysInterviews.map((a: any, i: number) => {
                     let time = '';
                     try { const m = JSON.parse(a.notes.slice('RF_INTERVIEW:'.length)); time = m?.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''; } catch {}
                     return (
                       <div key={i} className="py-3 flex items-center justify-between">
                         <div>
                           <p className="text-sm font-semibold text-[#0A2540]">{a.seeker?.name || 'Candidate'}</p>
                           <p className="text-xs text-gray-500">{a.job_title} {time ? `• ${time}` : ''}</p>
                         </div>
                         <Link to="/employer/interviews"><Button variant="outline" size="sm">Details</Button></Link>
                       </div>
                     );
                   })}
                 </div>
               ) : (
                 <p className="text-sm text-gray-500 text-center">{statsLoading ? 'Loading...' : 'No interviews scheduled today'}</p>
               )}
            </div>
          </div>

          {/* Recommended Candidates (Locked) */}
          

          {/* Listing Performance */}
          <div className="space-y-4">
             <h2 className="text-xl font-bold text-[#0A2540]">Job Performance</h2>
             <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                {activeListings.length > 0 ? (
                  <div className="space-y-3">
                    {activeListings.slice(0, 4).map((job: any, i: number) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium truncate max-w-[140px]">{job.title}</span>
                          <span>{job.apps ?? 0} apps · {job.views ?? 0} views</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00C853] rounded-full"
                            style={{ width: `${Math.min(100, ((job.apps ?? 0) / Math.max(1, ...activeListings.map((j: any) => j.apps ?? 0))) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 text-sm py-6">{statsLoading ? 'Loading...' : 'No active listings yet.'}</p>
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
