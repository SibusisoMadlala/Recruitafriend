import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiCall, supabase } from '../lib/supabase';

type QueueItem = {
  id: string;
  employer_id: string;
  employer_name: string;
  employer_email: string | null;
  status: 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
  age_hours: number | null;
  reviewer_notes?: string | null;
  remediation_instructions?: string | null;
};

type QueueDetail = {
  submission: Record<string, any>;
  documents: Array<Record<string, any>>;
  employer: Record<string, any> | null;
};

const STATUSES: QueueItem['status'][] = ['pending_review', 'needs_info', 'approved', 'rejected', 'suspended'];

export default function AdminOnboardingQueue() {
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [rows, setRows] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QueueDetail | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');

  async function loadQueue() {
    setLoading(true);
    try {
      const { queue } = await apiCall(`/admin/onboarding/queue?status=${encodeURIComponent(statusFilter)}`, { requireAuth: true });
      setRows(queue || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedEmployerId) {
      setDetail(null);
      return;
    }

    (async () => {
      try {
        const payload = await apiCall(`/admin/onboarding/queue/${selectedEmployerId}`, { requireAuth: true });
        setDetail(payload);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load onboarding detail');
      }
    })();
  }, [selectedEmployerId]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.employer_id === selectedEmployerId) || null,
    [rows, selectedEmployerId]
  );

  async function applyDecision(action: 'approve' | 'reject' | 'request_info' | 'suspend' | 'reactivate') {
    if (!selectedEmployerId) return;
    setDecisionLoading(true);
    try {
      await apiCall(`/admin/onboarding/${selectedEmployerId}/decision`, {
        requireAuth: true,
        method: 'POST',
        body: JSON.stringify({
          action,
          reason: decisionReason,
          reviewerNotes: decisionReason,
          remediationInstructions: action === 'request_info' ? decisionReason : null,
        }),
      });
      toast.success('Decision applied');
      setDecisionReason('');
      await loadQueue();
      const payload = await apiCall(`/admin/onboarding/queue/${selectedEmployerId}`, { requireAuth: true });
      setDetail(payload);
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply decision');
    } finally {
      setDecisionLoading(false);
    }
  }

  async function viewDocument(doc: Record<string, any>) {
    const bucket = String(doc?.storage_bucket || '');
    const path = String(doc?.storage_path || '');
    if (!bucket || !path) {
      toast.error('Document path is missing');
      return;
    }

    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Unable to generate document URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast.error(error.message || 'Failed to open document');
    }
  }

  const applicationFields: Array<{ label: string; value: unknown }> = detail?.submission
    ? [
        { label: 'Company name', value: detail.submission.company_name },
        { label: 'Registration number', value: detail.submission.registration_number },
        { label: 'Tax number', value: detail.submission.tax_number },
        { label: 'Company website', value: detail.submission.company_website },
        { label: 'Business overview', value: detail.submission.business_overview },
        { label: 'Contact name', value: detail.submission.contact_name },
        { label: 'Contact email', value: detail.submission.contact_email },
        { label: 'Contact phone', value: detail.submission.contact_phone },
        { label: 'Address line 1', value: detail.submission.address_line1 },
        { label: 'Address line 2', value: detail.submission.address_line2 },
        { label: 'City', value: detail.submission.city },
        { label: 'Province', value: detail.submission.province },
        { label: 'Postal code', value: detail.submission.postal_code },
        { label: 'Country', value: detail.submission.country },
        { label: 'Submitted at', value: detail.submission.submitted_at ? new Date(detail.submission.submitted_at).toLocaleString() : null },
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2540]">Employer onboarding review queue</h1>
            <p className="mt-1 text-sm text-gray-500">Filter by status and prioritize oldest submissions first.</p>
          </div>
          <select
            className="rounded border border-gray-200 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500">Loading queue…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No submissions for the selected filter.</p>
          ) : rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedEmployerId(row.employer_id)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition ${selectedEmployerId === row.employer_id ? 'border-[#00C853] bg-[#00C853]/5' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0A2540]">{row.employer_name}</p>
                  <p className="text-xs text-gray-500">{row.employer_email || 'No email'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{row.status.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500">Age: {row.age_hours ?? 0}h</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        {!selectedEmployerId || !detail ? (
          <p className="text-sm text-gray-500">Select a submission to review documents and action decisions.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-[#0A2540]">{selectedRow?.employer_name || 'Employer details'}</h2>
              <p className="text-xs text-gray-500">Current status: {detail.employer?.employer_status || selectedRow?.status}</p>
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-semibold text-[#0A2540]">Full application details</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {applicationFields.map((field) => (
                  <div key={field.label} className="rounded border border-gray-200 bg-white px-3 py-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{field.label}</dt>
                    <dd className="mt-1 text-sm text-gray-700 break-words">{String(field.value || '—')}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#0A2540]">Submitted documents</p>
              <ul className="mt-2 space-y-2 text-xs text-gray-600">
                {(detail.documents || []).map((doc) => (
                  <li key={doc.id} className="rounded border border-gray-200 px-3 py-2">
                    <p className="font-semibold text-[#0A2540]">{doc.doc_type}</p>
                    <p>{doc.storage_bucket}/{doc.storage_path}</p>
                    <p>Status: {doc.verification_status}</p>
                    <button
                      type="button"
                      className="mt-2 rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      onClick={() => void viewDocument(doc)}
                    >
                      View document
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#0A2540]">Reviewer notes / reason</label>
              <textarea
                className="h-24 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Provide decision rationale or remediation guidance"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="rounded bg-[#00C853] px-3 py-2 text-sm font-semibold text-white hover:bg-[#00b64a] disabled:opacity-50" disabled={decisionLoading} onClick={() => applyDecision('approve')}>Approve</button>
              <button className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50" disabled={decisionLoading} onClick={() => applyDecision('request_info')}>Request info</button>
              <button className="rounded border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={decisionLoading} onClick={() => applyDecision('reject')}>Reject</button>
              <button className="rounded border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50" disabled={decisionLoading} onClick={() => applyDecision('suspend')}>Suspend</button>
              <button className="col-span-2 rounded border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50" disabled={decisionLoading} onClick={() => applyDecision('reactivate')}>Reactivate</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
