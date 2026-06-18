import { useEffect, useMemo, useState } from 'react';
import { Video, Calendar, Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiCall } from '../lib/supabase';
import type { Application } from '../types';
import { resolveAppCompanyName } from '../lib/companyDisplay';
import { VideoCallRoom } from '../components/VideoCallRoom';

const INTERVIEW_PREFIX = 'RF_INTERVIEW:';

type InterviewMeta = {
  scheduled_at?: string;
  link?: string;
  completed_at?: string;
  confirmed?: boolean;
  immediate?: boolean;
};

function parseInterviewMeta(notes?: string | null): InterviewMeta | null {
  if (!notes || !notes.startsWith(INTERVIEW_PREFIX)) return null;
  try { return JSON.parse(notes.slice(INTERVIEW_PREFIX.length)) as InterviewMeta; }
  catch { return null; }
}

function toInterviewNotes(meta: InterviewMeta) {
  return `${INTERVIEW_PREFIX}${JSON.stringify(meta)}`;
}

export default function VideoInterviews() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Application | null>(null);
  const [testingDevices, setTestingDevices] = useState(false);

  useEffect(() => { loadInterviews(); }, []);

  async function loadInterviews() {
    setLoading(true);
    try {
      const { applications: rows } = await apiCall('/applications/my', { requireAuth: true });
      setApplications((rows || []) as Application[]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load interviews');
    } finally {
      setLoading(false);
    }
  }

  async function testAudioVideo() {
    setTestingDevices(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
      toast.success('Camera and microphone look good');
    } catch {
      toast.error('Could not access camera/microphone. Check browser permissions.');
    } finally {
      setTestingDevices(false);
    }
  }

  async function handleAccept(app: Application) {
    setWorkingId(app.id);
    try {
      const current = parseInterviewMeta(app.notes) || {};
      const notes = toInterviewNotes({ ...current, confirmed: true });
      const { application: updated } = await apiCall(`/applications/${app.id}`, {
        requireAuth: true, method: 'PUT',
        body: JSON.stringify({ status: 'interview', notes }),
      });
      setApplications(prev => prev.map(a =>
        a.id === app.id ? { ...a, notes: updated.notes } : a
      ));
      toast.success('Interview accepted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept');
    } finally {
      setWorkingId(null);
    }
  }

  async function handleDecline(app: Application) {
    setWorkingId(app.id);
    try {
      await apiCall(`/applications/${app.id}`, {
        requireAuth: true, method: 'PUT',
        body: JSON.stringify({ status: 'shortlisted', notes: '' }),
      });
      setApplications(prev => prev.map(a =>
        a.id === app.id ? { ...a, status: 'shortlisted', notes: '' } : a
      ));
      toast.success('Interview declined.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline');
    } finally {
      setWorkingId(null);
    }
  }

  // Pending: status=interview, RF_INTERVIEW prefix, confirmed=false, no completed_at
  const pending = useMemo(() => applications.filter(a => {
    if (a.status !== 'interview') return false;
    const meta = parseInterviewMeta(a.notes);
    return meta !== null && !meta.confirmed && !meta.completed_at;
  }), [applications]);

  // Confirmed / immediate: status=interview, confirmed OR no prefix (legacy), not completed
  const confirmed = useMemo(() => applications.filter(a => {
    if (a.status !== 'interview') return false;
    const meta = parseInterviewMeta(a.notes);
    if (meta?.completed_at) return false;
    return !meta || meta.confirmed || meta.immediate;
  }), [applications]);

  return (
    <>
      {activeCall && (
        <VideoCallRoom
          applicationId={activeCall.id}
          jobTitle={(activeCall as any).job?.title || (activeCall as any).job_title}
          candidateName="You"
          onClose={() => setActiveCall(null)}
        />
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--rf-navy)]">Video Interviews</h1>
            <p className="text-[var(--rf-muted)]">Accept interview requests and join live video calls.</p>
          </div>
          <button
            disabled={testingDevices}
            onClick={testAudioVideo}
            className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-[var(--rf-radius-md)] text-sm border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-60"
          >
            {testingDevices ? 'Testing...' : 'Test Camera & Mic'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>Loading your interviews...</p>
          </div>
        ) : (
          <>
            {/* Pending requests section */}
            {pending.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[var(--rf-navy)] mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Interview Requests ({pending.length})
                </h2>
                <div className="grid gap-4">
                  {pending.map(app => {
                    const meta = parseInterviewMeta(app.notes)!;
                    return (
                      <div key={app.id} className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 border-l-4 border-amber-400">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-[var(--rf-navy)] text-lg">{app.job_title || 'Interview Request'}</h3>
                            <p className="text-sm text-[var(--rf-muted)]">{resolveAppCompanyName(app)}</p>
                            {meta.scheduled_at && (
                              <p className="flex items-center gap-1.5 text-sm text-amber-700 mt-2 font-medium">
                                <Calendar className="w-4 h-4" />
                                Proposed: {new Date(meta.scheduled_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              disabled={workingId === app.id}
                              onClick={() => handleAccept(app)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[#00C853] hover:bg-[#00B548] text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
                            >
                              {workingId === app.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <CheckCircle2 className="w-4 h-4" />}
                              Accept
                            </button>
                            <button
                              disabled={workingId === app.id}
                              onClick={() => handleDecline(app)}
                              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confirmed / upcoming section */}
            <div>
              <h2 className="text-lg font-bold text-[var(--rf-navy)] mb-3 flex items-center gap-2">
                <Video className="w-5 h-5 text-[var(--rf-green)]" />
                Upcoming Interviews ({confirmed.length})
              </h2>
              {confirmed.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-[var(--rf-navy)]">No confirmed interviews yet</p>
                  <p className="text-sm mt-1">
                    {pending.length > 0
                      ? 'Accept a request above to confirm one.'
                      : 'Employers will send interview requests once they review your application.'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {confirmed.map(app => {
                    const meta = parseInterviewMeta(app.notes);
                    return (
                      <div key={app.id} className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 border-l-4 border-[var(--rf-green)]">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-[var(--rf-navy)] text-lg">{app.job_title || 'Interview'}</h3>
                            <p className="text-sm text-[var(--rf-muted)]">{resolveAppCompanyName(app)}</p>
                            {meta?.scheduled_at && !meta.immediate && (
                              <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
                                <Calendar className="w-4 h-4" />
                                {new Date(meta.scheduled_at).toLocaleString()}
                              </p>
                            )}
                            {meta?.immediate && (
                              <p className="text-xs text-blue-600 mt-1 font-medium">Immediate / on-demand interview</p>
                            )}
                          </div>
                          <button
                            onClick={() => setActiveCall(app)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--rf-green)] hover:bg-[#00B548] text-white text-sm font-semibold rounded-lg transition-colors"
                          >
                            <Video className="w-4 h-4" />
                            Join Video Call
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
