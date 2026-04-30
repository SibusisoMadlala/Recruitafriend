import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Eye, Paperclip, Upload, Trash2, FileText, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { apiCall, supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import type { Application } from '../types';
import { resolveAppCompanyName } from '../lib/companyDisplay';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface SupportingDoc {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export default function SeekerApplications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [withdrawApp, setWithdrawApp] = useState<Application | null>(null);

  // Supporting documents dialog state
  const [docsApp, setDocsApp] = useState<Application | null>(null);
  const [docs, setDocs] = useState<SupportingDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  const statusFromQuery = searchParams.get('status');
  const [activeTab, setActiveTab] = useState<string>(statusFromQuery ? statusFromQuery.charAt(0).toUpperCase() + statusFromQuery.slice(1) : 'All');

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('status');
    if (tab) {
      setActiveTab(tab.charAt(0).toUpperCase() + tab.slice(1));
    }
  }, [searchParams]);

  async function loadApplications() {
    setLoading(true);
    try {
      const { applications: rows } = await apiCall('/applications/my', { requireAuth: true });
      setApplications(rows || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  async function openDocsDialog(app: Application) {
    setDocsApp(app);
    setDocs([]);
    setLoadingDocs(true);
    try {
      const { docs: rows } = await apiCall(`/applications/${app.id}/docs`, { requireAuth: true });
      setDocs(rows || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load documents');
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleDocUpload(file: File) {
    if (!docsApp || !profile?.id) return;

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Allowed formats: PDF, DOCX, DOC, JPG, PNG, WEBP');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large. Max size is 10 MB.');
      return;
    }
    if (docs.length >= 5) {
      toast.error('Maximum of 5 supporting documents per application.');
      return;
    }

    setUploadingDoc(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageBucket = 'application-docs';
      const storagePath = `${profile.id}/${docsApp.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      const { doc } = await apiCall(`/applications/${docsApp.id}/docs`, {
        requireAuth: true,
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || null,
          storageBucket,
          storagePath,
        }),
      });
      setDocs((prev) => [...prev, doc]);
      toast.success('Document uploaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!docsApp) return;
    setDeletingDocId(docId);
    try {
      await apiCall(`/applications/${docsApp.id}/docs/${docId}`, { method: 'DELETE', requireAuth: true });
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Document removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete document');
    } finally {
      setDeletingDocId(null);
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleWithdraw(app: Application) {
    setWorkingId(app.id);
    try {
      await apiCall(`/applications/${app.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected', notes: 'Withdrawn by seeker' }),
      });
      toast.success('Application withdrawn');
      await loadApplications();
    } catch (error: any) {
      toast.error(error.message || 'Failed to withdraw application');
    } finally {
      setWorkingId(null);
    }
  }

  const statusTabs = ['All', 'Applied', 'Viewed', 'Shortlisted', 'Interview', 'Offer', 'Rejected'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Applied': return 'bg-blue-100 text-blue-700';
      case 'Viewed': return 'bg-purple-100 text-purple-700';
      case 'Shortlisted': return 'bg-orange-100 text-orange-700';
      case 'Interview': return 'bg-teal-100 text-teal-700';
      case 'Offer': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredApps = useMemo(() => {
    if (activeTab === 'All') return applications;
    return applications.filter((app) => app.status.toLowerCase() === activeTab.toLowerCase());
  }, [activeTab, applications]);

  function selectTab(tab: string) {
    setActiveTab(tab);
    if (tab === 'All') {
      searchParams.delete('status');
      setSearchParams(searchParams);
      return;
    }
    setSearchParams({ status: tab.toLowerCase() });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--rf-navy)]">My Applications</h1>

      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex px-4 min-w-max">
            {statusTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => selectTab(tab)}
                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab 
                    ? 'border-[var(--rf-green)] text-[var(--rf-green)]' 
                    : 'border-transparent text-[var(--rf-muted)] hover:text-[var(--rf-navy)]'
                }`}
              >
                {tab}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab ? 'bg-green-50' : 'bg-gray-100'}`}>
                   {tab === 'All' ? applications.length : applications.filter((a) => a.status.toLowerCase() === tab.toLowerCase()).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-bold text-[var(--rf-muted)] uppercase tracking-wider">Job & Company</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-[var(--rf-muted)] uppercase tracking-wider">Location</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-[var(--rf-muted)] uppercase tracking-wider">Date Applied</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-[var(--rf-muted)] uppercase tracking-wider">Status</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-[var(--rf-muted)] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[var(--rf-muted)]">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Loading applications...
                  </td>
                </tr>
              )}
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-md bg-[var(--rf-navy)] text-white flex items-center justify-center font-bold mr-3">
                        {resolveAppCompanyName(app).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[var(--rf-navy)]">{app.job_title || 'Untitled role'}</div>
                        <div className="text-sm text-[var(--rf-muted)]">{resolveAppCompanyName(app)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-[var(--rf-text)]">{[app.job?.city, app.job?.province].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-4 px-6 text-sm text-[var(--rf-text)]">{new Date(app.created_at).toLocaleDateString()}</td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(app.status.charAt(0).toUpperCase() + app.status.slice(1))}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    {app.status === 'applied' && (
                       <div className="flex justify-end flex-wrap gap-2">
                         <button
                           onClick={() => openDocsDialog(app)}
                           className="flex items-center gap-1 text-sm font-semibold text-[var(--rf-muted)] hover:text-[var(--rf-navy)]"
                         >
                           <Paperclip className="w-3.5 h-3.5" /> Docs
                         </button>
                         <button disabled={workingId === app.id} onClick={() => setWithdrawApp(app)} className="text-sm font-semibold text-[var(--rf-muted)] hover:text-red-600 disabled:opacity-60">Withdraw</button>
                         <button onClick={() => navigate(`/jobs/${app.job_id}`)} className="text-sm font-semibold text-[var(--rf-green)] hover:underline">View Job</button>
                       </div>
                    )}
                    {app.status === 'viewed' && (
                       <span className="text-xs text-[var(--rf-muted)] flex items-center justify-end">
                          <Eye className="w-3 h-3 mr-1" /> Recruiter viewed
                       </span>
                    )}
                    {app.status === 'shortlisted' && (
                       <button onClick={() => navigate('/seeker/interviews')} className="text-sm font-semibold text-orange-600 hover:bg-orange-50 px-3 py-1 rounded">Prepare for Interview</button>
                    )}
                    {app.status === 'rejected' && (
                       <button onClick={() => navigate('/jobs')} className="text-sm font-semibold text-[var(--rf-muted)] hover:text-[var(--rf-green)]">Find Similar Jobs</button>
                    )}
                    {(app.status !== 'applied' && app.status !== 'viewed' && app.status !== 'shortlisted' && app.status !== 'rejected') && (
                       <button onClick={() => navigate(`/jobs/${app.job_id}`)} className="text-sm font-semibold text-[var(--rf-green)] hover:underline">View Details</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!loading && filteredApps.length === 0 && (
             <div className="text-center py-16">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Search className="w-8 h-8" />
               </div>
               <h3 className="text-lg font-bold text-[var(--rf-navy)]">No applications found</h3>
               <p className="text-[var(--rf-muted)] mb-4">Try changing the filter or apply to more jobs.</p>
               <Link to="/jobs" className="text-[var(--rf-green)] font-semibold hover:underline">Browse all jobs</Link>
             </div>
          )}
        </div>
      </div>

      {/* Supporting Documents Dialog */}
      <Dialog open={Boolean(docsApp)} onOpenChange={(open) => !open && setDocsApp(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supporting Documents</DialogTitle>
            <DialogDescription>
              Upload additional documents for your application to <span className="font-semibold">{docsApp?.job_title || 'this job'}</span>. Up to 5 files (PDF, DOCX, images, max 10 MB each).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <input
                ref={docInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleDocUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={uploadingDoc || docs.length >= 5}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-4 py-4 text-sm font-semibold text-[var(--rf-muted)] transition-colors hover:border-[var(--rf-green)] hover:text-[var(--rf-green)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploadingDoc ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Add Document</>  
                )}
              </button>
            </div>

            {loadingDocs ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--rf-muted)]" />
              </div>
            ) : docs.length === 0 ? (
              <p className="text-center text-sm text-[var(--rf-muted)] py-4">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <FileText className="w-5 h-5 flex-shrink-0 text-[var(--rf-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--rf-navy)]">{doc.file_name}</p>
                      {doc.file_size && (
                        <p className="text-xs text-[var(--rf-muted)]">{formatFileSize(doc.file_size)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={deletingDocId === doc.id}
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                      aria-label="Remove document"
                    >
                      {deletingDocId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(withdrawApp)} onOpenChange={(open) => !open && setWithdrawApp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
            <AlertDialogDescription>You can still apply to other jobs afterwards.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!withdrawApp) return;
                void handleWithdraw(withdrawApp);
                setWithdrawApp(null);
              }}
            >
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
