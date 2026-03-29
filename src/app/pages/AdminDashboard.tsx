import { useEffect, useMemo, useState } from 'react';
import { apiCall } from '../lib/supabase';

type QueueItem = {
  id: string;
  status: 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
  age_hours: number | null;
};

export default function AdminDashboard() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { queue: rows } = await apiCall('/admin/onboarding/queue', { requireAuth: true });
        setQueue(rows || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const counter = {
      pending_review: 0,
      needs_info: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      slaBreaches: 0,
      medianHours: 0,
    };

    const ages = queue.map((row) => row.age_hours).filter((age): age is number => typeof age === 'number');

    for (const row of queue) {
      counter[row.status] += 1;
      if ((row.age_hours || 0) > 72) {
        counter.slaBreaches += 1;
      }
    }

    if (ages.length > 0) {
      const sorted = [...ages].sort((a, b) => a - b);
      counter.medianHours = sorted[Math.floor(sorted.length / 2)];
    }

    return counter;
  }, [queue]);

  const cards = [
    { label: 'Pending', value: stats.pending_review },
    { label: 'Needs Info', value: stats.needs_info },
    { label: 'Approved', value: stats.approved },
    { label: 'Rejected', value: stats.rejected },
    { label: 'Suspended', value: stats.suspended },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#0A2540]">Onboarding Operations Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500">Track queue health, review throughput, and SLA risk in one place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-[#0A2540]">{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Median review latency</p>
          <p className="mt-2 text-2xl font-bold text-[#0A2540]">{loading ? '...' : `${stats.medianHours}h`}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SLA breaches (&gt;72h)</p>
          <p className="mt-2 text-2xl font-bold text-[#0A2540]">{loading ? '...' : stats.slaBreaches}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Backlog growth signal</p>
          <p className="mt-2 text-2xl font-bold text-[#0A2540]">{loading ? '...' : stats.pending_review + stats.needs_info}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0A2540]">Trend / throughput quick view</h2>
        <p className="mt-2 text-sm text-gray-600">
          Current backlog is {loading ? '...' : stats.pending_review + stats.needs_info}. Use the onboarding queue for status/date filters and action decisions.
        </p>
      </div>
    </div>
  );
}
