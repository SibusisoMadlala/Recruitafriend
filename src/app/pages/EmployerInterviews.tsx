import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Video, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { apiCall } from '../lib/supabase';

type EmployerApplication = {
   id: string;
   job_id: string;
   status: string;
   notes?: string | null;
   created_at: string;
   updated_at?: string;
   seeker_id?: string;
   seeker?: {
      name?: string;
      headline?: string;
      email?: string;
   };
   job_title?: string;
};

type InterviewMeta = {
   scheduled_at?: string;
   link?: string;
   completed_at?: string;
};

const INTERVIEW_PREFIX = 'RF_INTERVIEW:';

function parseInterviewMeta(notes?: string | null): InterviewMeta | null {
   if (!notes || !notes.startsWith(INTERVIEW_PREFIX)) return null;
   try {
      return JSON.parse(notes.slice(INTERVIEW_PREFIX.length)) as InterviewMeta;
   } catch {
      return null;
   }
}

function toInterviewNotes(meta: InterviewMeta) {
   return `${INTERVIEW_PREFIX}${JSON.stringify(meta)}`;
}

export default function EmployerInterviews() {
   const [activeTab, setActiveTab] = useState('upcoming');
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [applications, setApplications] = useState<EmployerApplication[]>([]);
   const [schedulingApp, setSchedulingApp] = useState<EmployerApplication | null>(null);
   const [scheduledAt, setScheduledAt] = useState('');
   const [meetingLink, setMeetingLink] = useState('');

   useEffect(() => {
      loadInterviews();
   }, []);

   async function loadInterviews() {
      setLoading(true);
      try {
         const { jobs } = await apiCall('/employer/jobs', { requireAuth: true });
         const rows = (jobs || []) as Array<{ id: string; title: string }>;

         const appResults = await Promise.all(
            rows.map(async (job) => {
               const { applications: jobApps } = await apiCall(`/jobs/${job.id}/applications`, { requireAuth: true });
               return ((jobApps || []) as EmployerApplication[]).map((app) => ({
                  ...app,
                  job_title: job.title,
               }));
            })
         );

         setApplications(appResults.flat());
      } catch (error: any) {
         toast.error(error.message || 'Failed to load interview data');
      } finally {
         setLoading(false);
      }
   }

   const requests = useMemo(
      () => applications.filter((app) => app.status === 'shortlisted'),
      [applications]
   );

   const upcomingInterviews = useMemo(
      () =>
         applications.filter((app) => {
            if (app.status !== 'interview') return false;
            const meta = parseInterviewMeta(app.notes);
            return !!meta?.scheduled_at && !meta?.completed_at;
         }),
      [applications]
   );

   const pastInterviews = useMemo(
      () =>
         applications.filter((app) => {
            const meta = parseInterviewMeta(app.notes);
            return app.status === 'interview' && !!meta?.completed_at;
         }),
      [applications]
   );

   async function saveSchedule() {
      if (!schedulingApp) return;
      if (!scheduledAt) {
         toast.error('Please set a date and time');
         return;
      }

      setSaving(true);
      try {
         const notes = toInterviewNotes({ scheduled_at: scheduledAt, link: meetingLink || undefined });
         const { application } = await apiCall(`/applications/${schedulingApp.id}`, {
            requireAuth: true,
            method: 'PUT',
            body: JSON.stringify({ status: 'interview', notes }),
         });

         setApplications((prev) =>
            prev.map((app) =>
               app.id === schedulingApp.id
                  ? { ...app, status: application.status, notes: application.notes, updated_at: application.updated_at }
                  : app
            )
         );

         toast.success('Interview scheduled');
         setSchedulingApp(null);
         setScheduledAt('');
         setMeetingLink('');
      } catch (error: any) {
         toast.error(error.message || 'Failed to schedule interview');
      } finally {
         setSaving(false);
      }
   }

   async function markCompleted(app: EmployerApplication) {
      const current = parseInterviewMeta(app.notes) || {};
      const nextNotes = toInterviewNotes({ ...current, completed_at: new Date().toISOString() });

      try {
         const { application } = await apiCall(`/applications/${app.id}`, {
            requireAuth: true,
            method: 'PUT',
            body: JSON.stringify({ status: 'interview', notes: nextNotes }),
         });
         setApplications((prev) =>
            prev.map((row) => (row.id === app.id ? { ...row, notes: application.notes, updated_at: application.updated_at } : row))
         );
         toast.success('Interview marked as completed');
      } catch (error: any) {
         toast.error(error.message || 'Failed to update interview');
      }
   }

   async function rejectRequest(app: EmployerApplication) {
      try {
         const { application } = await apiCall(`/applications/${app.id}`, {
            requireAuth: true,
            method: 'PUT',
            body: JSON.stringify({ status: 'rejected' }),
         });
         setApplications((prev) => prev.map((row) => (row.id === app.id ? { ...row, status: application.status } : row)));
         toast.success('Candidate moved to rejected');
      } catch (error: any) {
         toast.error(error.message || 'Failed to update candidate status');
      }
   }

   const statUpcoming = upcomingInterviews.length;
   const statCompleted = pastInterviews.filter((app) => {
      const completed = parseInterviewMeta(app.notes)?.completed_at;
      if (!completed) return false;
      const completedDate = new Date(completed);
      const now = new Date();
      return completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear();
   }).length;

   return (
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
               <h1 className="text-2xl font-bold text-[#0A2540]">Video Interviews</h1>
               <p className="text-gray-500">Manage and schedule your candidate interviews</p>
            </div>
            <Button variant="outline" onClick={loadInterviews} disabled={loading}>
               {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
               Refresh
            </Button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-blue-50 border-blue-100">
               <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-medium text-[#0A2540] flex items-center gap-2">
                     <Video className="h-5 w-5 text-blue-500" /> Upcoming
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-3xl font-bold text-[#0A2540]">{statUpcoming}</div>
                  <p className="text-sm text-gray-500">Interviews scheduled</p>
               </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-100">
               <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-medium text-[#0A2540] flex items-center gap-2">
                     <CheckCircle2 className="h-5 w-5 text-[#00C853]" /> Completed
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-3xl font-bold text-[#0A2540]">{statCompleted}</div>
                  <p className="text-sm text-gray-500">Interviews this month</p>
               </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-100">
               <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-medium text-[#0A2540] flex items-center gap-2">
                     <Clock className="h-5 w-5 text-purple-500" /> Requests
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="text-3xl font-bold text-[#0A2540]">{requests.length}</div>
                  <p className="text-sm text-gray-500">Pending shortlist requests</p>
               </CardContent>
            </Card>
         </div>

         <Tabs defaultValue="upcoming" className="w-full" onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-4">
               <TabsList>
                  <TabsTrigger value="upcoming">Upcoming ({upcomingInterviews.length})</TabsTrigger>
                  <TabsTrigger value="past">Past / Recorded ({pastInterviews.length})</TabsTrigger>
                  <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
               </TabsList>
            </div>

            <TabsContent value="upcoming" className="space-y-4">
               {loading ? (
                  <div className="text-center py-12 text-gray-500">
                     <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
                     <p>Loading interviews...</p>
                  </div>
               ) : upcomingInterviews.length > 0 ? (
                  upcomingInterviews.map((interview) => {
                     const meta = parseInterviewMeta(interview.notes);
                     const scheduledLabel = meta?.scheduled_at ? new Date(meta.scheduled_at).toLocaleString() : 'Not scheduled';
                     return (
                        <Card key={interview.id} className="hover:shadow-md transition-shadow">
                           <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                 <p className="font-semibold text-[#0A2540]">{interview.job_title || 'Interview'}</p>
                                 <p className="text-sm text-gray-500">{interview.seeker?.name || interview.seeker?.email || 'Candidate'}</p>
                                 <p className="text-xs text-gray-500 mt-1">{scheduledLabel}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                 <Button
                                    variant="outline"
                                    onClick={() => {
                                       if (!meta?.link) {
                                          toast.info('No interview link has been added yet');
                                          return;
                                       }
                                       window.open(meta.link, '_blank', 'noopener,noreferrer');
                                    }}
                                 >
                                    Join Link
                                 </Button>
                                 <Button variant="outline" onClick={() => {
                                    setSchedulingApp(interview);
                                    setScheduledAt(meta?.scheduled_at ? meta.scheduled_at.slice(0, 16) : '');
                                    setMeetingLink(meta?.link || '');
                                 }}>
                                    Reschedule
                                 </Button>
                                 <Button className="bg-[#00C853] hover:bg-[#00B548] text-white" onClick={() => markCompleted(interview)}>
                                    Mark Complete
                                 </Button>
                              </div>
                           </CardContent>
                        </Card>
                     );
                  })
               ) : (
                  <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl border-dashed border-2 border-gray-200 p-12">
                     <CalendarIcon className="w-12 h-12 text-gray-300 mb-4" />
                     <h3 className="text-lg font-bold text-[#0A2540]">No Upcoming Interviews</h3>
                     <p className="text-gray-500 text-sm">Move shortlisted candidates to interview and schedule them.</p>
                  </div>
               )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
               {pastInterviews.length > 0 ? (
                  pastInterviews.map((interview) => {
                     const meta = parseInterviewMeta(interview.notes);
                     return (
                        <Card key={interview.id}>
                           <CardContent className="p-6">
                              <p className="font-semibold text-[#0A2540]">{interview.job_title || 'Interview'}</p>
                              <p className="text-sm text-gray-500">{interview.seeker?.name || interview.seeker?.email || 'Candidate'}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                 Completed {meta?.completed_at ? new Date(meta.completed_at).toLocaleString() : 'recently'}
                              </p>
                           </CardContent>
                        </Card>
                     );
                  })
               ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                     <p className="text-gray-500">No past interviews to show.</p>
                  </div>
               )}
            </TabsContent>

            <TabsContent value="requests">
               {requests.length > 0 ? (
                  <div className="space-y-4">
                     {requests.map((request) => (
                        <Card key={request.id}>
                           <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div className="flex items-center gap-3">
                                 <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-[#0A2540] text-white text-xs">
                                       {(request.seeker?.name || '??').split(' ').map((n) => n[0]).join('')}
                                    </AvatarFallback>
                                 </Avatar>
                                 <div>
                                    <p className="font-semibold text-[#0A2540]">{request.seeker?.name || request.seeker?.email || 'Candidate'}</p>
                                    <p className="text-sm text-gray-500">{request.job_title || 'Role'}</p>
                                 </div>
                              </div>
                              <div className="flex gap-2">
                                 <Button
                                    className="bg-[#00C853] hover:bg-[#00B548] text-white"
                                    onClick={() => {
                                       setSchedulingApp(request);
                                       setScheduledAt('');
                                       setMeetingLink('');
                                    }}
                                 >
                                    Schedule
                                 </Button>
                                 <Button variant="outline" onClick={() => rejectRequest(request)}>Reject</Button>
                              </div>
                           </CardContent>
                        </Card>
                     ))}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                     <div className="bg-white p-4 rounded-full shadow-sm">
                        <AlertCircle className="w-8 h-8 text-gray-400" />
                     </div>
                     <div>
                        <h3 className="font-bold text-[#0A2540] text-lg">No Pending Requests</h3>
                        <p className="text-gray-500 max-w-md mx-auto">Shortlisted candidates will appear here for interview scheduling.</p>
                     </div>
                  </div>
               )}
            </TabsContent>
         </Tabs>

         <Dialog open={Boolean(schedulingApp)} onOpenChange={(open) => !open && setSchedulingApp(null)}>
            <DialogContent>
               <DialogHeader>
                  <DialogTitle>Schedule Interview</DialogTitle>
                  <DialogDescription>
                     Set a date/time and optional meeting link for {schedulingApp?.seeker?.name || 'this candidate'}.
                  </DialogDescription>
               </DialogHeader>

               <div className="space-y-3">
                  <div className="space-y-1.5">
                     <Label htmlFor="scheduledAt">Date and time</Label>
                     <Input
                        id="scheduledAt"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                     />
                  </div>
                  <div className="space-y-1.5">
                     <Label htmlFor="meetingLink">Meeting link (optional)</Label>
                     <Input
                        id="meetingLink"
                        type="url"
                        placeholder="https://meet.example.com/..."
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                     />
                  </div>
               </div>

               <DialogFooter>
                  <Button variant="outline" onClick={() => setSchedulingApp(null)}>Cancel</Button>
                  <Button className="bg-[#00C853] hover:bg-[#00B548] text-white" onClick={saveSchedule} disabled={saving}>
                     {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                     Save Schedule
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   );
}
