import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useParams } from 'react-router';
import { Users, ChevronDown, MapPin, Mail, Phone, FileText, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { apiCall } from '../lib/supabase';

interface Job { id: string; title: string; apps: number; }
interface Seeker {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  headline: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  skills?: string[] | null;
  experience?: any[] | null;
  education?: any[] | null;
  video_introduction?: string | null;
}
interface Application {
  id: string;
  job_id: string;
  status: string;
  cover_letter: string | null;
  created_at: string;
  seeker: Seeker;
}

const COLUMNS = ['applied', 'viewed', 'shortlisted', 'interview', 'offer', 'rejected'];
const COLUMN_LABELS: Record<string, string> = {
  applied: 'New', viewed: 'Reviewed', shortlisted: 'Shortlisted',
  interview: 'Interview', offer: 'Offer', rejected: 'Rejected',
};
const COLUMN_COLORS: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700', viewed: 'bg-purple-100 text-purple-700',
  shortlisted: 'bg-amber-100 text-amber-700', interview: 'bg-teal-100 text-teal-700',
  offer: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

export default function EmployerApplicants() {
  const { jobId } = useParams();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApps, setLoadingApps] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [fetchedSeeker, setFetchedSeeker] = useState<Seeker | null>(null);
  const activeApplications = applications.filter((app) => COLUMNS.includes(app.status));

  // When a dialog opens and the nested seeker join returned null, fetch profile separately
  useEffect(() => {
    if (!selectedApplication) { setFetchedSeeker(null); return; }
    if (selectedApplication.seeker?.name) { setFetchedSeeker(null); return; } // join data is good
    const seekerId = (selectedApplication as any).seeker_id;
    if (!seekerId) return;

    apiCall(`/employer/seeker/${seekerId}`, { requireAuth: true })
      .then(({ profile }) => {
        setFetchedSeeker(profile || null);
      })
      .catch(() => {/* best-effort */});
  }, [selectedApplication]);

  useEffect(() => {
    (async () => {
      try {
        const { jobs: j } = await apiCall('/employer/jobs');
        setJobs(j || []);
        if (j && j.length > 0) {
          const preferredJobId = jobId && j.some((job: Job) => job.id === jobId) ? jobId : j[0].id;
          setSelectedJobId(preferredJobId);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load jobs');
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, [jobId]);

  useEffect(() => {
    if (!selectedJobId) { setApplications([]); return; }
    setLoadingApps(true);
    apiCall(`/jobs/${selectedJobId}/applications`, { requireAuth: true })
      .then(({ applications: apps }) => setApplications(apps || []))
      .catch((err: any) => toast.error(err.message || 'Failed to load applicants'))
      .finally(() => setLoadingApps(false));
  }, [selectedJobId]);

  async function moveStage(appId: string, status: string) {
    try {
      const { application, emailSent } = await apiCall(`/applications/${appId}`, {
        requireAuth: true,
        method: 'PUT', body: JSON.stringify({ status }),
      });
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: application.status } : a));
      
      const statusLabel = COLUMN_LABELS[status] || status;
      if (emailSent) {
        toast.success(`Moved to ${statusLabel} • Email sent to candidate`);
      } else {
        toast.success(`Moved to ${statusLabel}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  async function openApplicantProfile(app: Application) {
    setSelectedApplication(app);

    const seekerId = (app as any)?.seeker_id;
    if (app.seeker || !seekerId) return;

    setLoadingProfile(true);
    try {
      const { profile } = await apiCall(`/employer/seeker/${seekerId}`, { requireAuth: true });
      if (!profile) return;

      setSelectedApplication((prev) => (prev && prev.id === app.id ? { ...prev, seeker: profile } : prev));
      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, seeker: profile } : a)));
    } catch {
      // Keep modal open with available data; toast not needed here.
    } finally {
      setLoadingProfile(false);
    }
  }

  function handleViewCv() {
    if (!selectedSeeker) {
      toast.error('No candidate profile available to generate CV preview');
      return;
    }

    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const skills = (selectedSeeker.skills || []).map((s) => `<span style="display:inline-block;padding:4px 8px;margin:4px;border-radius:9999px;background:#eef6ff;color:#1d4ed8;font-size:12px;">${esc(s)}</span>`).join('');
    const exp = (selectedSeeker.experience || []).map((e: any) => `<li><strong>${esc(e?.title || 'Role')}</strong> — ${esc(e?.company || 'Company')}</li>`).join('');
    const edu = (selectedSeeker.education || []).map((e: any) => `<li><strong>${esc(e?.degree || 'Qualification')}</strong> — ${esc(e?.institution || 'Institution')}</li>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(selectedSeeker.name || 'Candidate')} CV</title></head>
      <body style="font-family:Arial,sans-serif;max-width:900px;margin:24px auto;padding:0 12px;color:#0A2540;">
        <h1 style="margin-bottom:4px;">${esc(selectedSeeker.name || 'Candidate')}</h1>
        <p style="margin-top:0;color:#475569;">${esc(selectedSeeker.headline || '')}</p>
        <p style="color:#475569;font-size:14px;">${esc(selectedSeeker.email || '')} ${selectedSeeker.phone ? `• ${esc(selectedSeeker.phone)}` : ''} ${selectedSeeker.location ? `• ${esc(selectedSeeker.location)}` : ''}</p>
        <h3>Professional Summary</h3>
        <p>${esc(selectedSeeker.summary || 'No professional summary provided.')}</p>
        <h3>Skills</h3>
        <div>${skills || '<p>No skills listed.</p>'}</div>
        <h3>Experience</h3>
        <ul>${exp || '<li>No experience entries.</li>'}</ul>
        <h3>Education</h3>
        <ul>${edu || '<li>No education entries.</li>'}</ul>
      </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  // Prefer the inline join data; fall back to separately-fetched profile when join returned null
  const selectedSeeker = (selectedApplication?.seeker?.name ? selectedApplication.seeker : fetchedSeeker) ?? selectedApplication?.seeker;

  return (
    <div className="flex h-full flex-col space-y-6 overflow-x-hidden">

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-0">
          <h1 className="text-2xl font-bold text-[#0A2540]">Applicants</h1>
          <div className="mt-1 flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
            <span className="text-sm text-gray-500">Viewing:</span>
            <button
              className="flex w-full items-center justify-between gap-2 rounded border border-gray-200 px-3 py-2 text-left text-sm font-medium text-[#0A2540] transition-colors hover:bg-gray-50 sm:w-auto sm:justify-start sm:border-transparent sm:px-2 sm:py-1 sm:hover:border-gray-200"
              onClick={() => setJobsOpen(v => !v)}
            >
              <span className="truncate">{selectedJob?.title || (loadingJobs ? 'Loading…' : 'Select Job')}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {jobsOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 shadow-lg sm:left-auto sm:right-auto sm:min-w-[240px]">
                {jobs.map(j => (
                  <button
                    key={j.id}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${j.id === selectedJobId ? 'text-[#00C853] font-semibold' : 'text-[#0A2540]'}`}
                    onClick={() => { setSelectedJobId(j.id); setJobsOpen(false); }}
                  >
                    {j.title} <span className="text-gray-400">({j.apps})</span>
                  </button>
                ))}
                {jobs.length === 0 && <p className="px-4 py-2 text-sm text-gray-400">No jobs yet</p>}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
          <div className="grid w-full grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 sm:flex sm:w-auto sm:items-center">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-gray-500'}`}
            >
              Kanban Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-gray-500'}`}
            >
              List View
            </button>
          </div>
        </div>
      </div>

      {/* No jobs yet */}
      {!loadingJobs && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] bg-white rounded-xl border-dashed border-2 border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-[#0A2540] mb-2">No Job Listings</h2>
          <p className="text-gray-500 mb-6 text-center max-w-sm">Post a job first to start receiving and tracking applications.</p>
          <Link to="/employer/post-job">
            <Button className="bg-[#00C853] hover:bg-[#00B548] text-white">Post a Job</Button>
          </Link>
        </div>
      )}

      {/* Loading apps */}
      {loadingApps && (
        <div className="text-center py-12 text-gray-400">Loading applicants…</div>
      )}

      {/* Kanban Board */}
      {!loadingApps && jobs.length > 0 && view === 'kanban' && (
        <div className="-mx-4 flex-1 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-[900px] gap-4 pb-1">
            {COLUMNS.map(col => {
              const colApps = applications.filter(a => a.status === col);
              return (
                <div key={col} className="flex max-h-[calc(100vh-280px)] w-[220px] flex-shrink-0 flex-col rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-gray-50/80 rounded-t-xl z-10">
                    <h3 className="font-semibold text-sm text-[#0A2540]">{COLUMN_LABELS[col]}</h3>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${COLUMN_COLORS[col]}`}>{colApps.length}</span>
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {colApps.length === 0 ? (
                      <div className="text-xs text-gray-300 text-center py-4">Drop here</div>
                    ) : colApps.map(app => (
                      <div key={app.id} className="bg-white rounded-lg border border-gray-100 shadow-xs p-3 text-sm hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-[#0A2540] text-white text-xs">
                              {(app.seeker?.name || '??').split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0A2540] truncate">{app.seeker?.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-400 truncate">{app.seeker?.headline || app.seeker?.email || ''}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{new Date(app.created_at).toLocaleDateString()}</p>
                        <select
                          className="w-full text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600 bg-white"
                          value={app.status}
                          onChange={e => moveStage(app.id, e.target.value)}
                        >
                          {COLUMNS.map(c => <option key={c} value={c}>{COLUMN_LABELS[c]}</option>)}
                        </select>
                        <button
                          type="button"
                          className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 text-[#0A2540] hover:bg-gray-50"
                          onClick={() => openApplicantProfile(app)}
                        >
                          View Profile
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {!loadingApps && jobs.length > 0 && view === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {applications.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No applicants for this job yet.</div>
          ) : (
            <>
              <div className="grid gap-4 p-4 md:hidden">
                {activeApplications.map((app) => (
                  <div key={app.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-[#0A2540] text-white text-xs">
                          {(app.seeker?.name || '??').split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#0A2540]">{app.seeker?.name || 'Unknown'}</p>
                        <p className="truncate text-xs text-gray-400">{app.seeker?.headline || app.seeker?.email}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Applied</p>
                        <p>{new Date(app.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
                        <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${COLUMN_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                          {COLUMN_LABELS[app.status] || app.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-[#0A2540] hover:bg-gray-50 sm:w-auto"
                        onClick={() => openApplicantProfile(app)}
                      >
                        View Profile
                      </button>
                      <select
                        className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 sm:w-auto"
                        value={app.status}
                        onChange={e => moveStage(app.id, e.target.value)}
                      >
                        {COLUMNS.map(c => <option key={c} value={c}>{COLUMN_LABELS[c]}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="p-4 font-semibold text-gray-700">Candidate</th>
                      <th className="p-4 font-semibold text-gray-700">Applied</th>
                      <th className="p-4 font-semibold text-gray-700">Status</th>
                      <th className="p-4 font-semibold text-gray-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {applications.map(app => (
                      <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-[#0A2540] text-white text-xs">
                                {(app.seeker?.name || '??').split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-[#0A2540]">{app.seeker?.name || 'Unknown'}</p>
                              <p className="text-xs text-gray-400">{app.seeker?.headline || app.seeker?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-500">{new Date(app.created_at).toLocaleDateString()}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${COLUMN_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                            {COLUMN_LABELS[app.status] || app.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-[#0A2540] hover:bg-gray-50"
                              onClick={() => openApplicantProfile(app)}
                            >
                              View Profile
                            </button>
                            <select
                              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600"
                              value={app.status}
                              onChange={e => moveStage(app.id, e.target.value)}
                            >
                              {COLUMNS.map(c => <option key={c} value={c}>{COLUMN_LABELS[c]}</option>)}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <Dialog open={!!selectedApplication} onOpenChange={(open) => !open && setSelectedApplication(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Applicant Profile</DialogTitle>
            <DialogDescription>
              Review candidate information and cover letter before moving them to the next stage.
            </DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleViewCv}
                  disabled={loadingProfile}
                  className="text-xs border border-gray-200 rounded px-3 py-1.5 text-[#0A2540] hover:bg-gray-50 disabled:opacity-60"
                >
                  View CV
                </button>
              </div>

              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-[#0A2540] text-white">
                    {(selectedSeeker?.name || '??').split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold text-[#0A2540]">{selectedSeeker?.name || 'Unknown Candidate'}</h3>
                  <p className="text-sm text-gray-500">{selectedSeeker?.headline || 'No headline provided'}</p>
                </div>
              </div>

              {loadingProfile && (
                <p className="text-xs text-gray-500">Loading candidate details…</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{selectedSeeker?.email || 'No email provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{selectedSeeker?.phone || 'No phone provided'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700 md:col-span-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{selectedSeeker?.location || 'No location provided'}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#0A2540] mb-2">Professional Summary</h4>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {selectedSeeker?.summary || 'No professional summary provided.'}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[#0A2540] mb-2">Skills</h4>
                {selectedSeeker?.skills && selectedSeeker.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedSeeker.skills.map((skill) => (
                      <span key={skill} className="px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No skills listed.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-[#0A2540] mb-2">Experience</h4>
                  {(selectedSeeker?.experience?.length || 0) > 0 ? (
                    <ul className="space-y-2 text-sm text-gray-600">
                      {(selectedSeeker?.experience || []).slice(0, 4).map((exp: any, i: number) => (
                        <li key={i} className="border border-gray-100 rounded p-2">
                          <p className="font-medium text-[#0A2540]">{exp?.title || 'Role'}</p>
                          <p>{exp?.company || 'Company'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No experience entries.</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-[#0A2540] mb-2">Education</h4>
                  {(selectedSeeker?.education?.length || 0) > 0 ? (
                    <ul className="space-y-2 text-sm text-gray-600">
                      {(selectedSeeker?.education || []).slice(0, 4).map((edu: any, i: number) => (
                        <li key={i} className="border border-gray-100 rounded p-2">
                          <p className="font-medium text-[#0A2540]">{edu?.degree || 'Qualification'}</p>
                          <p>{edu?.institution || 'Institution'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No education entries.</p>
                  )}
                </div>
              </div>

              {selectedSeeker?.video_introduction && (
                <div>
                  <h4 className="font-semibold text-[#0A2540] mb-2 flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Video Introduction
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-black">
                    <video
                      src={selectedSeeker.video_introduction}
                      controls
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-[#0A2540] mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Cover Letter
                </h4>
                <p className="text-sm text-gray-600 whitespace-pre-line border border-gray-100 rounded p-3 bg-gray-50">
                  {selectedApplication.cover_letter || 'No cover letter provided.'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
