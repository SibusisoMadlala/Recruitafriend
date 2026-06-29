import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiCall } from '../lib/supabase';
import {
  Loader2, ChevronRight, CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle,
  Users, Briefcase, FileText, Video, Building2, Activity, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, LineChart, Line,
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
  appsThisMonth: number;
  signupsThisMonth: number;
  interviewRate: number;
  offerRate: number;
};

type ChartPoint = { name: string; apps: number; signups: number };

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
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const dayStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
    return {
      name: label,
      apps: applications.filter(a => a.created_at?.slice(0, 10) === dayStr).length,
      signups: profiles.filter(p => p.created_at?.slice(0, 10) === dayStr).length,
    };
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [allRows, setAllRows]     = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QueueItem['status']>('pending_review');
  const [search, setSearch]       = useState('');
  const [stats, setStats]         = useState<PlatformStats>({ employers: 0, seekers: 0, jobs: 0, applications: 0, interviews: 0, aiNotes: 0, appsThisMonth: 0, signupsThisMonth: 0, interviewRate: 0, offerRate: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [authStats, setAuthStats] = useState({ totalAuthUsers: 0, emailConfirmed: 0, unconfirmed: 0, googleSignins: 0, emailSignins: 0, last7DaysSignups: 0, peakDay: 'N/A' });
  const [dailyAuth, setDailyAuth] = useState<any[]>([]);
  const [weeklySignups, setWeeklySignups] = useState<any[]>([]);
  const [signupsByDow, setSignupsByDow] = useState<any[]>([]);

  useEffect(() => { loadQueue(); loadStats(); }, []);

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const results = await Promise.all(
        ALL_STATUSES.map(s => apiCall(`/admin/onboarding/queue?status=${s}`, { requireAuth: true }).then(r => r.queue || []))
      );
      setAllRows(results.flat());
    } finally { setQueueLoading(false); }
  }

  async function loadStats() {
    setStatsLoading(true);
    try {
      const data = await apiCall('/admin/stats', { requireAuth: true });
      setStats({
        employers: data.employers, seekers: data.seekers, jobs: data.jobs,
        applications: data.applications, interviews: data.interviews, aiNotes: data.aiNotes,
        appsThisMonth: data.appsThisMonth, signupsThisMonth: data.signupsThisMonth,
        interviewRate: data.interviewRate, offerRate: data.offerRate,
      });
      setChartData(buildChartData(30, data.recentApps ?? [], data.recentProfiles ?? []));
      setRecentSignups(data.recentSignups ?? []);
      setAuthStats({ totalAuthUsers: data.totalAuthUsers ?? 0, emailConfirmed: data.emailConfirmed ?? 0, unconfirmed: data.unconfirmed ?? 0, googleSignins: data.googleSignins ?? 0, emailSignins: data.emailSignins ?? 0, last7DaysSignups: data.last7DaysSignups ?? 0, peakDay: data.peakDay ?? 'N/A' });
      setDailyAuth(data.dailyAuth ?? []);
      setWeeklySignups(data.weeklySignups ?? []);
      setSignupsByDow(data.signupsByDow ?? []);
    } catch (err) { console.error(err); }
    finally { setStatsLoading(false); }
  }

  const queueStats = useMemo(() => {
    const c = { approved: 0, pending_review: 0, needs_info: 0, rejected: 0, suspended: 0, slaBreaches: 0 };
    for (const row of allRows) { c[row.status]++; if ((row.age_hours || 0) > 72) c.slaBreaches++; }
    return c;
  }, [allRows]);

  const tabRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allRows.filter(r => r.status === activeTab)
      .filter(r => !q || (r.employer_name || '').toLowerCase().includes(q) || (r.employer_email || '').toLowerCase().includes(q));
  }, [allRows, activeTab, search]);

  const N = (n: number) => statsLoading ? '—' : n.toLocaleString();
  const P = (n: number) => statsLoading ? '—' : `${n}%`;
  const allZero = (arr: any[], key: string) => arr.every(d => (d[key] ?? 0) === 0);
  const NoData = () => (
    <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 22 }}>📭</span>
      <span style={{ fontSize: 12, color: '#9ca3af' }}>No data yet</span>
    </div>
  );

  const funnelData = [
    { name: 'Applications', value: stats.appsThisMonth },
    { name: 'Interviewed', value: Math.round(stats.appsThisMonth * stats.interviewRate / 100) },
    { name: 'Offered', value: Math.round(stats.appsThisMonth * stats.offerRate / 100) },
  ];

  const roleTag: Record<string, { label: string; dot: string }> = {
    employer: { label: 'Employer', dot: '#0A2540' },
    seeker:   { label: 'Seeker',   dot: '#00C853' },
    admin:    { label: 'Admin',    dot: '#7c3aed' },
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .rf-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .rf-metrics-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
        .rf-chart-row{display:grid;grid-template-columns:1fr 260px;gap:20px;margin-bottom:24px}
        .rf-chart-row-2col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
        .rf-queue-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
        .rf-hero{background:linear-gradient(135deg,#0A2540 0%,#0d3260 100%);border-radius:16px;padding:24px;margin-bottom:20px;color:#fff}
        @media(max-width:640px){
          .rf-kpi-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px}
          .rf-metrics-grid{grid-template-columns:repeat(2,1fr)!important;gap:10px}
          .rf-chart-row{grid-template-columns:1fr!important}
          .rf-chart-row-2col{grid-template-columns:1fr!important}
          .rf-queue-tabs{grid-template-columns:repeat(3,1fr)!important;gap:8px}
          .rf-hero{padding:18px 16px!important;border-radius:12px!important}
        }
      `}</style>

      {/* ═══════════════════ HERO BANNER ═══════════════════ */}
      <div className="rf-hero">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00C853', marginBottom: 4 }}>RecruitFriend · Admin</p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>Platform Overview</h1>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
              {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span style={{ background: 'rgba(0,200,83,0.15)', border: '1px solid rgba(0,200,83,0.4)', color: '#00C853', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, background: '#00C853', borderRadius: '50%', display: 'inline-block' }} />
            Live
          </span>
        </div>

        {/* 6 main KPIs */}
        <div className="rf-kpi-grid">
          {[
            { label: 'Employers',    value: N(stats.employers),    icon: Building2, accent: '#60a5fa' },
            { label: 'Seeker Profiles', value: N(stats.seekers),   icon: Users,     accent: '#00C853' },
            { label: 'Jobs Posted',  value: N(stats.jobs),         icon: Briefcase, accent: '#f59e0b' },
            { label: 'Applications', value: N(stats.applications), icon: FileText,  accent: '#a78bfa' },
            { label: 'Interviews',   value: N(stats.interviews),   icon: Video,     accent: '#f87171' },
            { label: 'AI Notes',     value: N(stats.aiNotes),      icon: Activity,  accent: '#34d399' },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Icon size={15} color={accent} />
                <ArrowUpRight size={12} color="rgba(255,255,255,0.25)" />
              </div>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</p>
              <p style={{ margin: '5px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════ METRICS ROW ═══════════════════ */}
      <div className="rf-metrics-grid">
        {[
          { label: 'Apps This Month',  value: N(stats.appsThisMonth),       sub: 'last 30 days',       color: '#0A2540' },
          { label: 'New Signups',      value: N(stats.signupsThisMonth),    sub: 'last 30 days',       color: '#0A2540' },
          { label: 'Interview Rate',   value: P(stats.interviewRate),       sub: 'apps → interview',   color: stats.interviewRate >= 30 ? '#16a34a' : '#d97706' },
          { label: 'Offer Rate',       value: P(stats.offerRate),           sub: 'apps → offer',       color: stats.offerRate >= 10 ? '#16a34a' : '#d97706' },
          { label: 'Pending Review',   value: N(queueStats.pending_review), sub: 'employers in queue', color: queueStats.pending_review > 0 ? '#d97706' : '#16a34a' },
          { label: 'SLA Breaches',     value: N(queueStats.slaBreaches),    sub: 'over 72 hours',      color: queueStats.slaBreaches > 0 ? '#dc2626' : '#16a34a' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e5e7eb' }}>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</p>
            <p style={{ margin: '4px 0 2px', fontSize: 12, fontWeight: 600, color: '#0A2540' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ═══════════════════ CHART + FUNNEL + SIGNUPS ═══════════════════ */}
      <div className="rf-chart-row">

        {/* Activity chart */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px 24px 16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A2540' }}>Activity — Last 30 Days</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>Daily applications and new signups</p>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, background: '#00C853', borderRadius: 2, display: 'inline-block' }} />Applications</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 3, background: '#0A2540', borderRadius: 2, display: 'inline-block' }} />Signups</span>
            </div>
          </div>
          {statsLoading ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={28} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00C853" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0A2540" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0A2540" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} interval={4} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="apps" name="Applications" stroke="#00C853" strokeWidth={2} fill="url(#gApps)" />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#0A2540" strokeWidth={2} fill="url(#gSig)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right column: Conversion funnel + Recent signups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Conversion funnel */}
          <div style={{ background: '#0A2540', borderRadius: 16, padding: '20px 20px', flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#fff' }}>Conversion Funnel</p>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>This month</p>
            {statsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
                <Loader2 size={20} color="#00C853" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {funnelData.map((row, i) => {
                  const pct = funnelData[0].value > 0 ? Math.round((row.value / funnelData[0].value) * 100) : 0;
                  const colors = ['#00C853', '#60a5fa', '#f59e0b'];
                  return (
                    <div key={row.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{row.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: colors[i] }}>{row.value}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors[i], borderRadius: 4, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent signups */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Recent Signups</p>
            {statsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60 }}>
                <Loader2 size={20} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentSignups.map(u => {
                  const rt = roleTag[u.user_type] || { label: u.user_type, dot: '#9ca3af' };
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0A2540', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{(u.name || '?')[0].toUpperCase()}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0A2540', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unknown'}</p>
                        <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>{new Date(u.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: rt.dot + '18', color: rt.dot, whiteSpace: 'nowrap' }}>{rt.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ═══════════════════ HIRING TRENDS ═══════════════════ */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px 24px 16px', border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TrendingUp size={16} color="#00C853" />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0A2540' }}>Hiring Trends</p>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9ca3af' }}>Daily application volume — last 30 days</p>
        {statsLoading ? <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={22} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} /></div> : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} interval={4} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="apps" name="Applications" fill="#00C853" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ═══════════════════ AUTH STATS CARDS ═══════════════════ */}
      <div style={{ background: 'linear-gradient(135deg,#0A2540 0%,#0d3260 100%)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
        <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00C853' }}>User Auth Analytics</p>
        <div className="rf-kpi-grid">
          {[
            { label: 'Total Users',    value: N(authStats.totalAuthUsers), accent: '#60a5fa' },
            { label: 'Email Verified', value: N(authStats.emailConfirmed),  accent: '#00C853' },
            { label: 'Unconfirmed',    value: N(authStats.unconfirmed),     accent: '#f87171' },
            { label: 'Google Sign-ins',value: N(authStats.googleSignins),   accent: '#f59e0b' },
            { label: 'Last 7 Days',    value: N(authStats.last7DaysSignups),accent: '#a78bfa' },
            { label: 'Peak Day',       value: statsLoading ? '—' : authStats.peakDay, accent: '#34d399' },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</p>
              <p style={{ margin: '5px 0 0', fontSize: 10, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════ DAILY SIGNUPS + DAILY LOGINS ═══════════════════ */}
      <div className="rf-chart-row-2col">
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 12px', border: '1px solid #e5e7eb' }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#0A2540' }}>Daily Signups</p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>New users per day</p>
          {statsLoading ? <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} /></div>
            : allZero(dailyAuth, 'signups') ? <NoData />
            : (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={dailyAuth} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
                <defs><linearGradient id="gDS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00C853" stopOpacity={0.25}/><stop offset="95%" stopColor="#00C853" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} interval={4} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#00C853" strokeWidth={2} fill="url(#gDS)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 12px', border: '1px solid #e5e7eb' }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#0A2540' }}>Daily Active Logins</p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>Users by last sign-in date</p>
          {statsLoading ? <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} /></div>
            : allZero(dailyAuth, 'logins') ? <NoData />
            : (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={dailyAuth} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} interval={4} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="logins" name="Logins" stroke="#0A2540" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ═══════════════════ WEEKLY SIGNUPS + DAY OF WEEK ═══════════════════ */}
      <div className="rf-chart-row-2col" style={{ marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 12px', border: '1px solid #e5e7eb' }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#0A2540' }}>Weekly Signups</p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>By week starting date</p>
          {statsLoading ? <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} /></div>
            : allZero(weeklySignups, 'count') ? <NoData />
            : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={weeklySignups} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" name="Signups" fill="#0A2540" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 12px', border: '1px solid #e5e7eb' }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#0A2540' }}>Signups by Day of Week</p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#9ca3af' }}>All-time totals</p>
          {statsLoading ? <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} /></div>
            : allZero(signupsByDow, 'count') ? <NoData />
            : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={signupsByDow} margin={{ top: 2, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="count" name="Signups" fill="#00C853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ═══════════════════ AUTH PROVIDER + EMAIL CONFIRMATION ═══════════════════ */}
      <div className="rf-chart-row-2col" style={{ marginBottom: 28 }}>
        <div style={{ background: '#0A2540', borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Auth Provider Split</p>
          <p style={{ margin: '0 0 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Email vs Google</p>
          {statsLoading ? <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="#00C853" style={{ animation: 'spin 1s linear infinite' }} /></div> : (
            <div>
              {[
                { label: 'Email', value: authStats.emailSignins, color: '#60a5fa' },
                { label: 'Google', value: authStats.googleSignins, color: '#f59e0b' },
              ].map(row => {
                const pct = authStats.totalAuthUsers > 0 ? Math.round((row.value / authStats.totalAuthUsers) * 100) : 0;
                return (
                  <div key={row.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ background: '#0A2540', borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Email Confirmation</p>
          <p style={{ margin: '0 0 20px', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Verification status</p>
          {statsLoading ? <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="#00C853" style={{ animation: 'spin 1s linear infinite' }} /></div> : (
            <div>
              {[
                { label: 'Confirmed', value: authStats.emailConfirmed, color: '#00C853' },
                { label: 'Unconfirmed', value: authStats.unconfirmed, color: '#f87171' },
              ].map(row => {
                const pct = authStats.totalAuthUsers > 0 ? Math.round((row.value / authStats.totalAuthUsers) * 100) : 0;
                return (
                  <div key={row.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{row.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════ ONBOARDING QUEUE ═══════════════════ */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#0A2540', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} color="#00C853" />
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>Employer Onboarding Queue</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Review and manage employer accounts</p>
            </div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            style={{ height: 34, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0 12px', fontSize: 12, outline: 'none', width: 200, color: '#fff' }}
          />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            const { Icon } = cfg;
            const active = activeTab === s;
            const count = queueLoading ? '…' : queueStats[s];
            return (
              <button key={s} onClick={() => setActiveTab(s)}
                style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 12px', border: 'none', borderBottom: `3px solid ${active ? cfg.color : 'transparent'}`, background: active ? cfg.bg : '#fff', cursor: 'pointer', transition: 'all 0.15s', minWidth: 90 }}>
                <Icon size={14} color={active ? cfg.color : '#9ca3af'} />
                <span style={{ fontSize: 18, fontWeight: 800, color: active ? cfg.color : '#0A2540' }}>{count}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? cfg.color : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Rows */}
        {queueLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} color="#0A2540" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : tabRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <CheckCircle2 size={32} color="#e5e7eb" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>No {STATUS_CONFIG[activeTab].label.toLowerCase()} accounts</p>
          </div>
        ) : (
          tabRows.map((row, idx) => {
            const cfg = STATUS_CONFIG[row.status];
            return (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: idx < tabRows.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: cfg.bg, border: `2px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: cfg.color, fontSize: 13, fontWeight: 800 }}>{(row.employer_name || '?')[0].toUpperCase()}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0A2540', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.employer_name || 'Unknown'}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.employer_email || 'No email'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <StatusBadge status={row.status} />
                  <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{row.age_hours ?? 0}h</span>
                  <button onClick={() => navigate('/admin/onboarding')}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', background: '#0A2540', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Review <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
