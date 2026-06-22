import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Video, CheckCircle2, Loader2, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { apiCall, supabase } from '../lib/supabase';
import { VideoCallRoom } from '../components/VideoCallRoom';

type EmployerApplication = {
  id: string;
  job_id: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  seeker_id?: string;
  seeker?: { name?: string; headline?: string; email?: string };
  job_title?: string;
};

type InterviewMeta = {
  scheduled_at?: string;
  link?: string;
  completed_at?: string;
  confirmed?: boolean;
  immediate?: boolean;
};

const INTERVIEW_PREFIX = 'RF_INTERVIEW:';

function parseInterviewMeta(notes?: string | null): InterviewMeta | null {
  if (!notes || !notes.startsWith(INTERVIEW_PREFIX)) return null;
  try { return JSON.parse(notes.slice(INTERVIEW_PREFIX.length)) as InterviewMeta; }
  catch { return null; }
}

function toInterviewNotes(meta: InterviewMeta) {
  return `${INTERVIEW_PREFIX}${JSON.stringify(meta)}`;
}

export default function EmployerInterviews() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [schedulingApp, setSchedulingApp] = useState<EmployerApplication | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [activeCall, setActiveCall] = useState<EmployerApplication | null>(null);

  useEffect(() => { loadInterviews(); }, []);

  async function loadInterviews() {
    setLoading(true);
    try {
      const { applications: allApps } = await apiCall('/employer/applications', { requireAuth: true });
      const apps = (allApps || []) as EmployerApplication[];
      setApplications(apps);
      // Auto-rejoin if page was refreshed mid-call
      const savedId = sessionStorage.getItem('rf_employer_call');
      if (savedId) {
        const saved = apps.find(a => a.id === savedId);
        if (saved) setActiveCall(saved);
        else sessionStorage.removeItem('rf_employer_call');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // Upcoming: interview status, confirmed, not completed
  const upcoming = useMemo(() => applications.filter(a => {
    if (a.status !== 'interview') return false;
    const meta = parseInterviewMeta(a.notes);
    return meta?.confirmed && !meta?.completed_at;
  }), [applications]);

  // Awaiting reply: interview status, not confirmed yet
  const awaitingReply = useMemo(() => applications.filter(a => {
    if (a.status !== 'interview') return false;
    const meta = parseInterviewMeta(a.notes);
    return !meta?.confirmed && !meta?.completed_at;
  }), [applications]);

  // Completed
  const completed = useMemo(() => applications.filter(a => {
    const meta = parseInterviewMeta(a.notes);
    return a.status === 'interview' && !!meta?.completed_at;
  }), [applications]);

  // All applicants eligible to schedule (not already in interview/offer/rejected/completed)
  const schedulable = useMemo(() => applications.filter(a =>
    a.status !== 'offer' && a.status !== 'rejected'
  ), [applications]);

  async function requestInterview(app: EmployerApplication, immediate: boolean) {
    setSaving(true);
    try {
      const meta: InterviewMeta = immediate
        ? { immediate: true, confirmed: true, scheduled_at: new Date().toISOString() }
        : { scheduled_at: scheduledAt, confirmed: false };

      const notes = toInterviewNotes(meta);
      const { application } = await apiCall(`/applications/${app.id}`, {
        requireAuth: true, method: 'PUT',
        body: JSON.stringify({ status: 'interview', notes }),
      });
      setApplications(prev => prev.map(a =>
        a.id === app.id ? { ...a, status: application.status, notes: application.notes } : a
      ));
      toast.success(immediate ? 'Interview started! Share your screen with the candidate.' : 'Interview request sent to candidate.');
      setSchedulingApp(null);
      setScheduledAt('');
      if (immediate) {
        sessionStorage.setItem('rf_employer_call', app.id);
        setActiveCall({ ...app, status: 'interview', notes });
      }

      // Fire push notification to candidate (best-effort, don't block UI)
      if (app.seeker_id) {
        const notifBody = immediate
          ? `Your interview for ${app.job_title || 'a position'} is starting now. Open the app to join.`
          : `You have an interview request for ${app.job_title || 'a position'}. Tap to view and confirm.`;
        supabase.functions.invoke('send-push', {
          body: {
            seeker_id: app.seeker_id,
            title: '📅 Interview ' + (immediate ? 'Starting Now' : 'Request'),
            body: notifBody,
            url: '/seeker/interviews',
            tag: 'interview',
          },
        }).catch(() => {}); // silent — notification is optional
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send interview request');
    } finally {
      setSaving(false);
    }
  }

  async function markCompleted(app: EmployerApplication) {
    const current = parseInterviewMeta(app.notes) || {};
    const notes = toInterviewNotes({ ...current, completed_at: new Date().toISOString() });
    try {
      const { application } = await apiCall(`/applications/${app.id}`, {
        requireAuth: true, method: 'PUT',
        body: JSON.stringify({ status: 'interview', notes }),
      });
      setApplications(prev => prev.map(a =>
        a.id === app.id ? { ...a, notes: application.notes } : a
      ));
      toast.success('Interview marked as completed');
      sessionStorage.removeItem('rf_employer_call');
      setActiveCall(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    }
  }

  function candidateLabel(app: EmployerApplication) {
    return app.seeker?.name || app.seeker?.email || 'Candidate';
  }

  return (
    <>
      {activeCall && (
        <VideoCallRoom
          applicationId={activeCall.id}
          candidateName={candidateLabel(activeCall)}
          jobTitle={activeCall.job_title}
          isHost={true}
          onClose={() => { sessionStorage.removeItem('rf_employer_call'); setActiveCall(null); }}
        />
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2540]">Video Interviews</h1>
            <p className="text-gray-500">Schedule, manage and conduct candidate interviews</p>
          </div>
          <Button variant="outline" onClick={loadInterviews} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Upcoming', value: upcoming.length, color: 'bg-blue-50', icon: <Video className="h-5 w-5 text-blue-500" /> },
            { label: 'Awaiting Reply', value: awaitingReply.length, color: 'bg-amber-50', icon: <Clock className="h-5 w-5 text-amber-500" /> },
            { label: 'Completed', value: completed.length, color: 'bg-green-50', icon: <CheckCircle2 className="h-5 w-5 text-[#00C853]" /> },
            { label: 'Total Applicants', value: schedulable.length, color: 'bg-purple-50', icon: <Users className="h-5 w-5 text-purple-500" /> },
          ].map(s => (
            <Card key={s.label} className={`${s.color} border-0 shadow-sm`}>
              <CardContent className="p-4 flex items-center gap-3">
                {s.icon}
                <div>
                  <div className="text-2xl font-bold text-[#0A2540]">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="schedule">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="schedule">Schedule ({schedulable.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="awaiting">Awaiting Reply ({awaitingReply.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>

          {/* Schedule tab — all applicants */}
          <TabsContent value="schedule" className="space-y-3 mt-4">
            {loading ? (
              <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : schedulable.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-3" />
                <p>No applicants yet. Post a job to start receiving applications.</p>
              </div>
            ) : schedulable.map(app => (
              <Card key={app.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0A2540]">{candidateLabel(app)}</p>
                    <p className="text-sm text-gray-500">{app.job_title || 'Position'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      app.status === 'interview' ? 'bg-blue-100 text-blue-700' :
                      app.status === 'shortlisted' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{app.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-[#00C853] hover:bg-[#00B548] text-white"
                      onClick={() => { setSchedulingApp(app); setScheduledAt(''); }}
                    >
                      <CalendarIcon className="w-4 h-4 mr-1.5" />
                      Schedule Interview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={() => requestInterview(app, true)}
                      disabled={saving}
                    >
                      <Zap className="w-4 h-4 mr-1.5" />
                      Start Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Upcoming tab */}
          <TabsContent value="upcoming" className="space-y-3 mt-4">
            {upcoming.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-[#0A2540]">No Upcoming Interviews</p>
                <p className="text-sm text-gray-500 mt-1">Schedule one from the Schedule tab.</p>
              </div>
            ) : upcoming.map(app => {
              const meta = parseInterviewMeta(app.notes);
              return (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0A2540]">{candidateLabel(app)}</p>
                      <p className="text-sm text-gray-500">{app.job_title}</p>
                      {meta?.scheduled_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(meta.scheduled_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="bg-[#00C853] hover:bg-[#00B548] text-white"
                        onClick={() => { sessionStorage.setItem('rf_employer_call', app.id); setActiveCall(app); }}
                      >
                        <Video className="w-4 h-4 mr-1.5" />
                        Start Video Call
                      </Button>
                      <Button variant="outline" onClick={() => markCompleted(app)}>
                        Mark Complete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Awaiting reply tab */}
          <TabsContent value="awaiting" className="space-y-3 mt-4">
            {awaitingReply.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-3" />
                <p>No pending interview requests.</p>
              </div>
            ) : awaitingReply.map(app => {
              const meta = parseInterviewMeta(app.notes);
              return (
                <Card key={app.id} className="border-amber-200">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0A2540]">{candidateLabel(app)}</p>
                      <p className="text-sm text-gray-500">{app.job_title}</p>
                      {meta?.scheduled_at && (
                        <p className="text-xs text-amber-600 mt-1">
                          Proposed: {new Date(meta.scheduled_at).toLocaleString()}
                        </p>
                      )}
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        Waiting for candidate to accept
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={() => { sessionStorage.setItem('rf_employer_call', app.id); setActiveCall(app); }}
                    >
                      <Zap className="w-4 h-4 mr-1.5" />
                      Start Anyway
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Completed tab */}
          <TabsContent value="completed" className="space-y-3 mt-4">
            {completed.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3" />
                <p>No completed interviews yet.</p>
              </div>
            ) : completed.map(app => {
              const meta = parseInterviewMeta(app.notes);
              return (
                <Card key={app.id}>
                  <CardContent className="p-4">
                    <p className="font-semibold text-[#0A2540]">{candidateLabel(app)}</p>
                    <p className="text-sm text-gray-500">{app.job_title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Completed {meta?.completed_at ? new Date(meta.completed_at).toLocaleString() : 'recently'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* Schedule dialog */}
        <Dialog open={Boolean(schedulingApp)} onOpenChange={(open) => !open && setSchedulingApp(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Interview</DialogTitle>
              <DialogDescription>
                Set a date and time for {schedulingApp ? candidateLabel(schedulingApp) : 'this candidate'}.
                They will receive a request and can accept or propose a different time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="scheduledAt">Date and time</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSchedulingApp(null)}>Cancel</Button>
              <Button
                className="bg-[#00C853] hover:bg-[#00B548] text-white"
                onClick={() => schedulingApp && requestInterview(schedulingApp, false)}
                disabled={saving || !scheduledAt}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Send Interview Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
