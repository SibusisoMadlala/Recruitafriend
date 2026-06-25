import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area
} from 'recharts';
import { Users, CheckCircle, Clock, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { apiCall } from '../lib/supabase';

interface ChartPoint { name: string; apps: number; }

function buildChartData(applications: any[], days: number): ChartPoint[] {
  const now = new Date();
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets[d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })] = 0;
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  for (const app of applications) {
    const created = new Date(app.created_at);
    if (created < cutoff) continue;
    const key = created.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([name, apps]) => ({ name, apps }));
}

export default function EmployerAnalytics() {
  const [dateRange, setDateRange] = useState('30d');
  const [statsData, setStatsData] = useState({ views: 0, applications: 0, hired: 0, avgDays: 0 });
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Two parallel calls instead of N+1 sequential calls
        const [{ jobs }, { applications: allApps }] = await Promise.all([
          apiCall('/employer/jobs', { requireAuth: true }),
          apiCall('/employer/applications', { requireAuth: true }),
        ]);

        const jobList: any[] = jobs || [];
        const appsByJob: any[] = allApps || [];

        const totalViews = jobList.reduce((s: number, j: any) => s + (j.views || 0), 0);

        let avgDays = 0;
        if (jobList.length > 0) {
          const daysList = jobList.map((j: any) => {
            const firstApp = appsByJob
              .filter((a: any) => a.job_id === j.id)
              .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
            if (!firstApp) return null;
            return Math.round((new Date(firstApp.created_at).getTime() - new Date(j.created_at).getTime()) / 86400000);
          }).filter((d: number | null) => d !== null) as number[];
          avgDays = daysList.length ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length) : 0;
        }

        setStatsData({ views: totalViews, applications: appsByJob.length, hired: 0, avgDays });
        setAllApplications(appsByJob);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function exportCsv() {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const row = (...cells: (string | number)[]) => cells.map(c => q(c)).join(',');
    const blank = '';
    const now = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });

    const lines: string[] = [];

    // ── Section 1: Report header ──
    lines.push(row('RecruitFriend Analytics Report'));
    lines.push(row('Generated', now));
    lines.push(row('Period', rangeLabel));
    lines.push(blank);

    // ── Section 2: Summary metrics ──
    lines.push(row('SUMMARY METRICS', ''));
    lines.push(row('Metric', 'Value'));
    lines.push(row('Total Job Views', statsData.views));
    lines.push(row(`Applications (${rangeLabel})`, rangeApps.length));
    lines.push(row(`Interviews / Offers (${rangeLabel})`, rangeApps.filter(a => a.status === 'offer' || a.status === 'interview').length));
    lines.push(row('Avg Days to First Application', statsData.avgDays));
    lines.push(blank);

    // ── Section 3: Conversion funnel ──
    lines.push(row('CONVERSION FUNNEL', ''));
    lines.push(row('Stage', 'Count', 'Conversion Rate'));
    lines.push(row('Job Views', funnelViews, '100%'));
    lines.push(row('Applications', funnelApps, funnelViews ? `${Math.round((funnelApps / funnelViews) * 100)}%` : '0%'));
    lines.push(row('Interviews', funnelIntvw, funnelApps ? `${Math.round((funnelIntvw / funnelApps) * 100)}%` : '0%'));
    lines.push(row('Offers', funnelHired, funnelIntvw ? `${Math.round((funnelHired / funnelIntvw) * 100)}%` : '0%'));
    lines.push(blank);

    // ── Section 4: Applications over time ──
    lines.push(row('APPLICATIONS OVER TIME', ''));
    lines.push(row('Date', 'Applications'));
    buildChartData(allApplications, dayCount).forEach(r => lines.push(row(r.name, r.apps)));
    lines.push(blank);

    // ── Section 5: Individual applications ──
    lines.push(row('ALL APPLICATIONS IN PERIOD', ''));
    lines.push(row('Date Applied', 'Job Title', 'Applicant Name', 'Applicant Email', 'Status'));
    rangeApps.forEach(a => {
      const date = new Date(a.created_at).toLocaleDateString('en-ZA');
      const title = a.job?.title || a.job_title || 'N/A';
      const name  = a.seeker?.name || a.candidate_name || 'N/A';
      const email = a.seeker?.email || a.candidate_email || 'N/A';
      const status = String(a.status || 'pending').replace(/_/g, ' ');
      lines.push(row(date, title, name, email, status));
    });

    // UTF-8 BOM so Excel / MS365 / Google Sheets opens it correctly
    const BOM = '﻿';
    const csv = BOM + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RecruitFriend_Analytics_${dateRange}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics exported — open with Excel or Google Sheets');
  }

  const dayCount = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
  const chartData = buildChartData(allApplications, dayCount);
  const hasData = allApplications.length > 0;

  // Stats scoped to the selected date range so they match the chart
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayCount);
  const rangeApps = allApplications.filter(a => new Date(a.created_at) >= cutoff);
  const rangeLabel = dateRange === '7d' ? 'Last 7 Days' : dateRange === '90d' ? 'Last 90 Days' : 'Last 30 Days';

  const metrics = [
    { label: 'Total Job Views',                  value: loading ? '…' : String(statsData.views),     change: '', icon: Eye },
    { label: `Applications (${rangeLabel})`,     value: loading ? '…' : String(rangeApps.length),    change: '', icon: Users },
    { label: `Interviews / Offers (${rangeLabel})`, value: loading ? '…' : String(rangeApps.filter(a => a.status === 'offer' || a.status === 'interview').length), change: '', icon: CheckCircle },
    { label: 'Avg Days to Apply',                value: loading ? '…' : `${statsData.avgDays} Days`, change: '', icon: Clock },
  ];

  // funnel values scoped to date range
  const funnelViews = statsData.views;
  const funnelApps  = rangeApps.length;
  const funnelIntvw = rangeApps.filter(a => a.status === 'interview').length;
  const funnelHired = rangeApps.filter(a => a.status === 'offer').length;
  const funnelMax   = Math.max(funnelViews, 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0A2540]">Analytics Dashboard</h1>
          <p className="text-gray-500">Track your recruitment performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={exportCsv} title="Export CSV" disabled={loading || !hasData}>
            <Download className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm transition-transform hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 text-[#0A2540] rounded-lg">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-[#0A2540]">{stat.value}</h3>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {!hasData ? (
        <Card className="border-none shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-gray-50 p-6 rounded-full mb-4">
            <BarChart className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-xl font-semibold text-[#0A2540] mb-2">No Analytics Data Yet</h3>
          <p className="text-gray-500 max-w-md">
            Your analytics will appear here once you start receiving job views and applications.
          </p>
        </Card>
      ) : rangeApps.length === 0 ? (
        <Card className="border-none shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-gray-50 p-6 rounded-full mb-4">
            <BarChart className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-xl font-semibold text-[#0A2540] mb-2">No Applications in This Period</h3>
          <p className="text-gray-500 max-w-md">
            You have {allApplications.length} total application{allApplications.length !== 1 ? 's' : ''} but none in the {rangeLabel.toLowerCase()}. Try selecting a wider date range.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Applications Over Time */}
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader>
              <CardTitle>Applications Over Time</CardTitle>
              <CardDescription>Daily application volume.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C853" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} dy={10} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="apps" stroke="#00C853" strokeWidth={2} fillOpacity={1} fill="url(#colorApps)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Conversion Funnel */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Conversion Funnel</CardTitle>
              <CardDescription>Views to Offer ratio.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { label: 'Job Views',    value: funnelViews, color: 'bg-blue-500' },
                  { label: 'Applications', value: funnelApps,  color: 'bg-purple-500' },
                  { label: 'Interviews',   value: funnelIntvw, color: 'bg-amber-500' },
                  { label: 'Offers',       value: funnelHired, color: 'bg-emerald-500' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">{row.label}</span>
                      <span className="font-semibold text-[#0A2540]">{row.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${row.color} rounded-full`}
                        style={{ width: `${Math.round((row.value / funnelMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
