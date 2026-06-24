import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiCall } from '../lib/supabase';
import { Loader2, ChevronRight, CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle } from 'lucide-react';

type QueueItem = {
  id: string;
  employer_id: string;
  employer_name: string;
  employer_email: string | null;
  status: 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
  age_hours: number | null;
};

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [allRows, setAllRows]     = useState<QueueItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<QueueItem['status']>('approved');
  const [search, setSearch]       = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          ALL_STATUSES.map(s => apiCall(`/admin/onboarding/queue?status=${s}`, { requireAuth: true }).then(r => r.queue || []))
        );
        setAllRows(results.flat());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
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

  const statCards = [
    { label: 'Approved',       value: stats.approved,       status: 'approved' as const },
    { label: 'Pending Review', value: stats.pending_review, status: 'pending_review' as const },
    { label: 'Needs Info',     value: stats.needs_info,     status: 'needs_info' as const },
    { label: 'Rejected',       value: stats.rejected,       status: 'rejected' as const },
    { label: 'Suspended',      value: stats.suspended,      status: 'suspended' as const },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0A2540]">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Manage employer accounts and onboarding submissions.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map(card => {
          const cfg = STATUS_CONFIG[card.status];
          return (
            <button
              key={card.status}
              onClick={() => setActiveTab(card.status)}
              className={`rounded-xl border p-5 shadow-sm text-left transition-all ${activeTab === card.status ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-gray-100 bg-white hover:border-gray-300'}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${activeTab === card.status ? 'text-blue-200' : 'text-gray-500'}`}>{card.label}</p>
              <p className={`mt-2 text-3xl font-bold ${activeTab === card.status ? 'text-white' : 'text-[#0A2540]'}`}>
                {loading ? '…' : card.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* SLA & backlog */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SLA Breaches (&gt;72h)</p>
          <p className="mt-2 text-2xl font-bold text-[#0A2540]">{loading ? '…' : stats.slaBreaches}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Backlog</p>
          <p className="mt-2 text-2xl font-bold text-[#0A2540]">{loading ? '…' : stats.pending_review + stats.needs_info}</p>
        </div>
      </div>

      {/* Employer list */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-[#0A2540]">
            {STATUS_CONFIG[activeTab].label} Accounts
            <span className="ml-2 text-sm font-normal text-gray-400">({loading ? '…' : tabRows.length})</span>
          </h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#0A2540] w-56"
          />
        </div>

        {loading ? (
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
                    <span className="text-white text-sm font-bold">
                      {(row.employer_name || '?')[0].toUpperCase()}
                    </span>
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
  );
}
