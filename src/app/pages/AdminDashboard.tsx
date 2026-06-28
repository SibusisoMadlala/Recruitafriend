import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiCall, supabase } from '../lib/supabase';
import {
  Loader2, ChevronRight, CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle,
  Users, Briefcase, FileText, Video, Building2, Activity, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

type QueueItem = {
  id: string;
  employer_id: string;
  employer_name: string;
  employer_email: string | null;
  status: 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
  age_hours: number | null;
};

type PlatformStats = {
  employers: number;
  seekers: number;
  jobs: number;
  applications: number;
  interviews: number;
  aiNotes: number;
};

type ChartPoint = { name: string; apps: number; signups: number; };

const STATUS_CONFIG: Record<QueueItem['status'], { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  approved:       { label: 'Approved',       color: '#16a34a', bg: '#dcfce7', Icon: CheckCircle2 },
  pending_review: { label: 'Pending Review', color: '#d97706', bg: '#fef3c7', Icon: Clock },
  needs_info:     { label: 'Needs Info',     color: '#2563eb', bg: '#dbeafe', Icon: AlertCircle },
  rejected:       { label: 'Rejected',       color: '#dc2626', bg: '#fee2e2', Icon: XCircle },
  suspended:      { label: 'Suspended',      color: '#7c3aed', bg: '#ede9fe', Icon: PauseCircle },
};

const ALL_STATUSES: QueueItem['status'][] = ['approved', 'pending_review', 'needs_info', 'rejected', 'suspended'];

function StatusBadge({ status }: { status: QueueItem['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const { Icon } = cfg;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 99, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function buildChartData(days: number, applications: any[], profiles: any[]): ChartPoint[] {
  const now = new Date();
  const points: ChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
    const dayStr = d.toISOString().slice(0, 10);
    const apps = applications.filter(a => a.created_at?.slice(0, 10) === dayStr).length;
    const signups = profiles.filter(p => p.created_at?.slice(0, 10) === dayStr).length;
    points.push({ name: label, apps, signups });
  }
  return points;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Onboarding queue state
  const [allRows, setAllRows]     = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QueueItem['status']>('pending_review');
  const [search, setSearch]       = useState('');

  // Platform stats state
  const [platformStats, setPlatformStats] = useState<PlatformStats>({ employers: 0, seekers: 0, jobs: 0, applications: 0, interviews: 0, aiNotes: 0 });
  const [statsLoading, setStatsLoading]   = useState(true);
  const [chartData, setChartData]         = useState<ChartPoint[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadQueue();
    loadPlatformStats();
  }, []);

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const results = await Promise.all(
        ALL_STATUSES.map(s => apiCall(`/admin/onboarding/queue?status=${s}`, { requireAuth: true }).then(r => r.queue || []))
      );
      setAllRows(results.flat());
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadPlatformStats() {
    setStatsLoading(true);
    try {
      const [
        { count: employers },
        { count: seekers },
        { count: jobs },
        { count: applications },
        { count: interviews },
        { count: aiNotes },
        { data: recentApps },
        { data: recentProfiles },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'employer'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seeker'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id', { count: 'exact', head: true }),
        supabase.from('call_recordings').select('id', { count: 'exact', head: true }),
        supabase.from('interview_ai_notes').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('profiles').select('created_at, role').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);

      setPlatformStats({
        employers: employers ?? 0,
        seekers: seekers ?? 0,
        jobs: jobs ?? 0,
        applications: applications ?? 0,
        interviews: interviews ?? 0,
        aiNotes: aiNotes ?? 0,
      });

      setChartData(buildChartData(30, recentApps ?? [], recentProfiles ?? []));

      // Recent activity: last 8 profiles that signed up
      const { data: recent } = await supabase
        .from('profiles')
        .select('id, name, role, created_at, avatar_url')
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentActivity(recent ?? []);
    } catch (err) {
      console.error('Failed to load platform stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }

  const queueStats = useMemo(() => {
    const counter = { approved: 0, pending_review: 0, needs_info: 0, rejected: 0, suspended: 0, slaBreaches: 0 };
    for (const row of allRows) {
      counter[row.status] += 1;
      if ((row.age_hours || 0) > 72) counter.slaBreaches += 1;
    }
    return counter;
  }, [allRows]);

  const tabRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allRows
      .filter(r => r.status === activeTab)
      .filter(r => !q || (r.employer_name || '').toLowerCase().includes(q) || (r.employer_email || '').toLowerCase().includes(q));
  }, [allRows, activeTab, search]);

  const platformCards = [
    { label: 'Employers',     value: platformStats.employers,    icon: Building2,  color: '#0A2540', bg: '#e8f0fe' },
    { label: 'Job Seekers',   value: platformStats.seekers,      icon: Users,      color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Jobs Posted',   value: platformStats.jobs,         icon: Briefcase,  color: '#0891b2', bg: '#cffafe' },
    { label: 'Applications',  value: platformStats.applications,  icon: FileText,   color: '#d97706', bg: '#fef3c7' },
    { label: 'Interviews',    value: platformStats.interviews,   icon: Video,      color: '#dc2626', bg: '#fee2e2' },
    { label: 'AI Notes',      value: platformStats.aiNotes,      icon: Activity,   color: '#16a34a', bg: '#dcfce7' },
  ];

  const roleTag: Record<string, { label: string; color: string }> = {
    employer: { label: 'Employer', color: 'bg-blue-100 text-[#0A2540]' },
    seeker:   { label: 'Seeker',   color: 'bg-green-100 text-green-700' },
    admin:    { label: 'Admin',    color: 'bg-purple-100 text-purple-700' },
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A2540]">Platform Dashboard</h1>
          <p className="text-gray-500">Live overview of RecruitFriend activity.</p>
        </div>
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0A2540] text-white text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse" />
          Live
        </span>
      </div>

      {/* Platform stat cards — same pattern as Employer Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {platformCards.map((card, i) => (
          <Card key={i} className="border-none shadow-sm transition-transform hover:scale-[1.02]">
            <CardContent className="p-5">
              <div className="p-2 rounded-lg w-fit mb-3" style={{ background: card.bg }}>
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <p className="text-2xl font-bold text-[#0A2540]">
                {statsLoading ? '…' : card.value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity chart + Recent signups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart — spans 2 cols */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Activity — Last 30 Days</CardTitle>
            <CardDescription>Applications and new signups per day</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {statsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-7 h-7 animate-spin text-[#0A2540]" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminGradApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C853" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="adminGradSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0A2540" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0A2540" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} interval={4} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="apps" name="Applications" stroke="#00C853" strokeWidth={2} fillOpacity={1} fill="url(#adminGradApps)" />
                  <Area type="monotone" dataKey="signups" name="Signups" stroke="#0A2540" strokeWidth={2} fillOpacity={1} fill="url(#adminGradSignups)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent signups */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
            <CardDescription>Latest users to join</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-[#0A2540]" />
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No signups yet</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(u => {
                  const tag = roleTag[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0A2540] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-white text-xs font-bold">{(u.name || '?')[0].toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0A2540] truncate">{u.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${tag.color}`}>{tag.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Queue */}
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-5 h-5 text-[#0A2540]" />
          <h2 className="text-xl font-bold text-[#0A2540]">Employer Onboarding Queue</h2>
        </div>

        {/* Status tabs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5 mb-4">
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setActiveTab(s)}
                className={`rounded-xl border p-4 text-left transition-all ${activeTab === s ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-gray-100 bg-white hover:border-gray-300'}`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${activeTab === s ? 'text-blue-200' : 'text-gray-500'}`}>{cfg.label}</p>
                <p className={`mt-1 text-2xl font-bold ${activeTab === s ? 'text-white' : 'text-[#0A2540]'}`}>
                  {queueLoading ? '…' : queueStats[s]}
                </p>
              </button>
            );
          })}
        </div>

        {/* SLA + backlog */}
        <div className="grid gap-3 md:grid-cols-2 mb-5">
          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SLA Breaches (&gt;72 h)</p>
              <p className="mt-1 text-2xl font-bold text-[#0A2540]">{queueLoading ? '…' : queueStats.slaBreaches}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Backlog</p>
              <p className="mt-1 text-2xl font-bold text-[#0A2540]">{queueLoading ? '…' : queueStats.pending_review + queueStats.needs_info}</p>
            </CardContent>
          </Card>
        </div>

        {/* Employer table */}
        <Card className="border-none shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-bold text-[#0A2540]">
              {STATUS_CONFIG[activeTab].label} Accounts
              <span className="ml-2 text-sm font-normal text-gray-400">({queueLoading ? '…' : tabRows.length})</span>
            </h3>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#0A2540] w-56"
            />
          </div>

          {queueLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#0A2540]" />
            </div>
          ) : tabRows.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              No {STATUS_CONFIG[activeTab].label.toLowerCase()} accounts found.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tabRows.map(row => (
                <div key={row.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#0A2540] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{(row.employer_name || '?')[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0A2540] truncate">{row.employer_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 truncate">{row.employer_email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-gray-400 hidden sm:block">{row.age_hours ?? 0}h ago</span>
                    <button
                      onClick={() => navigate('/admin/onboarding')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#0A2540] text-white text-xs font-semibold rounded-lg hover:bg-[#0d2f50] transition-colors"
                    >
                      Review <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// suppress unused import warning — Sparkles reserved for future AI insights widget
void Sparkles;
