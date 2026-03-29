import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/useAuth';
import { apiCall, supabase } from '../lib/supabase';
import { Navbar } from '../components/Navbar';

type EmployerStatus = 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';

type OnboardingStatusPayload = {
  employer_status: EmployerStatus;
  guidance?: { message?: string; guidance?: string };
  remediation?: { reviewer_notes?: string | null; instructions?: string | null };
  latest_submission?: Record<string, any> | null;
};

const REQUIRED_DOCS = ['registration_proof', 'tax_document'] as const;
type RequiredDocType = (typeof REQUIRED_DOCS)[number];

type UploadedDoc = {
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export default function EmployerOnboardingStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, refreshProfile } = useAuth();
  const [statusPayload, setStatusPayload] = useState<OnboardingStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState<Record<RequiredDocType, boolean>>({
    registration_proof: false,
    tax_document: false,
  });
  const [uploadedDocs, setUploadedDocs] = useState<Record<RequiredDocType, UploadedDoc | null>>({
    registration_proof: null,
    tax_document: null,
  });

  const [form, setForm] = useState({
    companyName: '',
    registrationNumber: '',
    taxNumber: '',
    companyWebsite: '',
    businessOverview: '',
    contactName: profile?.name || '',
    contactEmail: profile?.email || '',
    contactPhone: '',
    addressLine1: '',
    city: '',
    province: '',
    registrationProofPath: '',
    taxDocumentPath: '',
  });

  async function loadStatus() {
    setLoading(true);
    try {
      const payload = await apiCall('/employer/onboarding/status', { requireAuth: true });
      setStatusPayload(payload);
      if (payload?.employer_status === 'approved') {
        await refreshProfile();
        navigate('/employer/dashboard', { replace: true });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load onboarding status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = useMemo(() => {
    return REQUIRED_DOCS.every((doc) => {
      if (doc === 'registration_proof') return !!form.registrationProofPath.trim();
      if (doc === 'tax_document') return !!form.taxDocumentPath.trim();
      return true;
    });
  }, [form.registrationProofPath, form.taxDocumentPath]);

  const employerStatus = statusPayload?.employer_status || 'pending_review';
  const hasExistingSubmission = !!statusPayload?.latest_submission;
  const showSubmittedState = !loading && hasExistingSubmission && employerStatus !== 'approved';
  const showSubmissionForm = !loading && !hasExistingSubmission && employerStatus !== 'suspended';
  const justSubmitted = searchParams.get('submitted') === '1';

  function sanitizeFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async function handleDocumentUpload(docType: RequiredDocType, file: File | null) {
    if (!file) return;
    if (!profile?.id) {
      toast.error('Unable to upload documents before profile is ready. Please refresh and try again.');
      return;
    }

    setUploadingDocs((prev) => ({ ...prev, [docType]: true }));
    try {
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${profile.id}/${docType}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from('employer-onboarding')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || undefined,
        });

      if (error) throw error;

      setUploadedDocs((prev) => ({
        ...prev,
        [docType]: {
          storagePath,
          originalFileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
        },
      }));

      if (docType === 'registration_proof') {
        setForm((prev) => ({ ...prev, registrationProofPath: storagePath }));
      } else {
        setForm((prev) => ({ ...prev, taxDocumentPath: storagePath }));
      }

      toast.success(`${docType.replace('_', ' ')} uploaded`);
    } catch (error: any) {
      toast.error(error.message || `Failed to upload ${docType.replace('_', ' ')}`);
    } finally {
      setUploadingDocs((prev) => ({ ...prev, [docType]: false }));
    }
  }

  async function submitOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await apiCall('/employer/onboarding/submissions', {
        requireAuth: true,
        method: 'POST',
        body: JSON.stringify({
          companyName: form.companyName,
          registrationNumber: form.registrationNumber,
          taxNumber: form.taxNumber,
          companyWebsite: form.companyWebsite,
          businessOverview: form.businessOverview,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          addressLine1: form.addressLine1,
          city: form.city,
          province: form.province,
          documents: [
            {
              docType: 'registration_proof',
              storagePath: form.registrationProofPath,
              storageBucket: 'employer-onboarding',
              originalFileName: uploadedDocs.registration_proof?.originalFileName,
              mimeType: uploadedDocs.registration_proof?.mimeType,
              fileSizeBytes: uploadedDocs.registration_proof?.fileSizeBytes,
            },
            {
              docType: 'tax_document',
              storagePath: form.taxDocumentPath,
              storageBucket: 'employer-onboarding',
              originalFileName: uploadedDocs.tax_document?.originalFileName,
              mimeType: uploadedDocs.tax_document?.mimeType,
              fileSizeBytes: uploadedDocs.tax_document?.fileSizeBytes,
            },
          ],
        }),
      });

      toast.success('Onboarding submitted successfully');
      await refreshProfile();
      navigate('/employer/onboarding-status?submitted=1', { replace: true });
      await loadStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit onboarding');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0A2540]">Employer onboarding status</h1>
        <p className="mt-2 text-sm text-gray-600">
          {loading ? 'Loading status…' : statusPayload?.guidance?.message || 'Submit your onboarding details to activate employer features.'}
        </p>
        {statusPayload?.guidance?.guidance && (
          <p className="mt-2 text-sm text-gray-500">{statusPayload.guidance.guidance}</p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0A2540]">Current state: {statusPayload?.employer_status || 'pending_review'}</h2>
        {(statusPayload?.remediation?.reviewer_notes || statusPayload?.remediation?.instructions) && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Reviewer guidance</p>
            <p>{statusPayload?.remediation?.reviewer_notes || statusPayload?.remediation?.instructions}</p>
          </div>
        )}
      </div>

      {showSubmittedState && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-emerald-900">Onboarding pending</h3>
          <p className="mt-2 text-sm text-emerald-900/90">
            {justSubmitted
              ? 'Your onboarding was submitted successfully and is now pending admin review.'
              : 'Your onboarding is pending admin review.'}
          </p>
          {employerStatus !== 'pending_review' && (
            <p className="mt-2 text-sm text-emerald-900/80">
              Current review outcome: <span className="font-semibold">{employerStatus.replace('_', ' ')}</span>
            </p>
          )}
          <p className="mt-2 text-sm text-emerald-900/80">Employers can submit onboarding only once. You&apos;ll be notified once a reviewer finalizes this submission.</p>

          <div className="mt-4 rounded-lg border border-emerald-200 bg-white/70 p-4 text-sm text-emerald-950">
            <p>
              <span className="font-semibold">Latest submission:</span>{' '}
              Revision {statusPayload?.latest_submission?.revision_no || 1}
            </p>
            {statusPayload?.latest_submission?.submitted_at && (
              <p className="mt-1 text-emerald-900/80">
                Submitted on {new Date(statusPayload.latest_submission.submitted_at).toLocaleString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void loadStatus()}
            className="mt-4 rounded border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            Refresh review status
          </button>
        </div>
      )}

      {showSubmissionForm && (
        <form onSubmit={submitOnboarding} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#0A2540]">Submit onboarding</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Company name" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} required />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Registration number" value={form.registrationNumber} onChange={(e) => setForm((p) => ({ ...p, registrationNumber: e.target.value }))} />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Tax number" value={form.taxNumber} onChange={(e) => setForm((p) => ({ ...p, taxNumber: e.target.value }))} />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Company website" value={form.companyWebsite} onChange={(e) => setForm((p) => ({ ...p, companyWebsite: e.target.value }))} />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Contact name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} required />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} required />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Contact phone" value={form.contactPhone} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} required />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Address line 1" value={form.addressLine1} onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))} required />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="City" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />
            <input className="rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Province" value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))} required />
          </div>

          <textarea
            className="h-24 w-full rounded border border-gray-200 px-3 py-2 text-sm"
            placeholder="Business overview"
            value={form.businessOverview}
            onChange={(e) => setForm((p) => ({ ...p, businessOverview: e.target.value }))}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="registration-proof-file" className="block text-sm font-medium text-[#0A2540]">
                Registration proof (required)
              </label>
              <input
                id="registration-proof-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void handleDocumentUpload('registration_proof', file);
                }}
                required
              />
              <p className="text-xs text-gray-500">
                {uploadingDocs.registration_proof
                  ? 'Uploading…'
                  : uploadedDocs.registration_proof
                    ? `Uploaded: ${uploadedDocs.registration_proof.originalFileName}`
                    : 'No file uploaded yet'}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="tax-document-file" className="block text-sm font-medium text-[#0A2540]">
                Tax document (required)
              </label>
              <input
                id="tax-document-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void handleDocumentUpload('tax_document', file);
                }}
                required
              />
              <p className="text-xs text-gray-500">
                {uploadingDocs.tax_document
                  ? 'Uploading…'
                  : uploadedDocs.tax_document
                    ? `Uploaded: ${uploadedDocs.tax_document.originalFileName}`
                    : 'No file uploaded yet'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="rounded bg-[#00C853] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00b64a] disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit onboarding'}
          </button>
        </form>
      )}
      </div>
    </div>
  );
}
