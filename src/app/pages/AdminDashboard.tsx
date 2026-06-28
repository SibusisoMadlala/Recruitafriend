import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiCall, supabase } from '../lib/supabase';
import {
  Loader2, ChevronRight, CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle,
  Users, Briefcase, FileText, Video, TrendingUp, Building2, UserCheck, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

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

  const roleColors: Record<string, string> = { employer: '#0A2540', seeker: '#00C853', admin: '#7c3aed' };

  return (
    <div className="space-y-8">

      {/* ── Hero Stats Bar ── */}
      <div style={{ background: 'linear-gradient(135deg, #0A2540 0%, #0d3260 100%)', borderRadius: 16, padding: '28px 32px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>RecruitFriend Admin</h1>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Platform overview · {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#00C853', color: '#fff', borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>● Live</span>
          </div>
        </div>

        {/* Primary platform numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
          {platformCards.map(card => (
            <div key={card.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ background: card.bg, borderRadius: 8, padding: 6 }}>
                  <card.icon size={14} color={card.color} />
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {statsLoading ? '—' : card.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity Chart + Recent Signups ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }} className="admin-chart-grid">
        {/* Chart */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A2540' }}>Activity — Last 30 Days</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Applications and new signups per day</p>
            </div>
            <TrendingUp size={18} color="#00C853" />
          </div>
          {statsLoading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={28} color="#0A2540" style={{ animation: 'rfSpin 1s linear infinite' }} />
              <style>{`@keyframes rfSpin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminGradApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adminGradSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A2540" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0A2540" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} interval={4} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="apps" name="Applications" stroke="#00C853" strokeWidth={2} fill="url(#adminGradApps)" />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#0A2540" strokeWidth={2} fill="url(#adminGradSignups)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent signups */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <UserCheck size={16} color="#0A2540" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A2540' }}>Recent Signups</h2>
          </div>
          {statsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Loader2 size={24} color="#0A2540" style={{ animation: 'rfSpin 1s linear infinite' }} />
            </div>
          ) : recentActivity.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 40 }}>No recent signups</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentActivity.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: roleColors[u.role] || '#0A2540', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{(u.name || '?')[0].toUpperCase()}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0A2540', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unknown'}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                      <span style={{ color: roleColors[u.role] || '#6b7280', fontWeight: 600, textTransform: 'capitalize' }}>{u.role}</span>
                      {' · '}{new Date(u.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Onboarding Queue ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Building2 size={18} color="#0A2540" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0A2540' }}>Employer Onboarding Queue</h2>
        </div>

        {/* Queue stat tabs */}
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5 mb-4">
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

        {/* SLA row */}
        <div className="grid gap-3 md:grid-cols-2 mb-6">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SLA Breaches (&gt;72h)</p>
            <p className="mt-1 text-2xl font-bold text-[#0A2540]">{queueLoading ? '…' : queueStats.slaBreaches}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Backlog</p>
            <p className="mt-1 text-2xl font-bold text-[#0A2540]">{queueLoading ? '…' : queueStats.pending_review + queueStats.needs_info}</p>
          </div>
        </div>

        {/* Employer table */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
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
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .admin-chart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
