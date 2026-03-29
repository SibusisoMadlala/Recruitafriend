import { useEffect, useMemo, useState } from 'react';
import { Video, Calendar, Clock, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { apiCall } from '../lib/supabase';
import type { Application } from '../types';

const INTERVIEW_PREFIX = 'RF_INTERVIEW:';

type InterviewMeta = {
  scheduled_at?: string;
  link?: string;
  completed_at?: string;
};

function parseInterviewMeta(notes?: string | null): InterviewMeta | null {
  if (!notes || !notes.startsWith(INTERVIEW_PREFIX)) return null;
  try {
    return JSON.parse(notes.slice(INTERVIEW_PREFIX.length)) as InterviewMeta;
  } catch {
    return null;
  }
}

export default function VideoInterviews() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingDevices, setTestingDevices] = useState(false);

  useEffect(() => {
    loadInterviews();
  }, []);

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
      stream.getTracks().forEach((track) => track.stop());
      toast.success('Audio and video access look good');
    } catch {
      toast.error('Could not access camera/microphone. Check browser permissions.');
    } finally {
      setTestingDevices(false);
    }
  }

  const upcomingInterviews = useMemo(
    () =>
      applications.filter((app) => {
        if (app.status !== 'interview') return false;
        const meta = parseInterviewMeta(app.notes);
        return !meta?.completed_at;
      }),
    [applications]
  );

  const onDemandInterviews = useMemo(
    () => applications.filter((app) => app.status === 'shortlisted'),
    [applications]
  );


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-bold text-[var(--rf-navy)]">Video Interviews</h1>
            <p className="text-[var(--rf-muted)]">Manage your upcoming calls and complete one-way interviews.</p>
         </div>
        <button
          disabled={testingDevices}
          onClick={testAudioVideo}
          className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-[var(--rf-radius-md)] text-sm border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-60"
        >
          {testingDevices ? 'Testing...' : 'Test Audio & Video'}
         </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'upcoming'
                ? 'border-[var(--rf-green)] text-[var(--rf-green)]'
                : 'border-transparent text-gray-500 hover:text-[var(--rf-navy)]'
            }`}
          >
            Upcoming Interviews ({upcomingInterviews.length})
          </button>
          <button
             onClick={() => setActiveTab('ondemand')}
             className={`py-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
               activeTab === 'ondemand'
                 ? 'border-[var(--rf-green)] text-[var(--rf-green)]'
                 : 'border-transparent text-gray-500 hover:text-[var(--rf-navy)]'
             }`}
          >
            On-Demand Interviews ({onDemandInterviews.length})
          </button>
        </div>
      </div>

      <div className="min-h-[400px]">
        {loading && (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            <p>Loading interviews...</p>
          </div>
        )}

        {activeTab === 'upcoming' && (
          <div className="grid gap-6">
             {!loading && upcomingInterviews.length > 0 ? (
                 upcomingInterviews.map((interview) => {
                    const meta = parseInterviewMeta(interview.notes);
                    const hasScheduledDate = Boolean(meta?.scheduled_at);
                    const scheduleLabel = hasScheduledDate
                      ? new Date(meta?.scheduled_at as string).toLocaleString()
                      : `Updated ${new Date(interview.updated_at || interview.created_at).toLocaleString()}`;

                    return (
                    <div key={interview.id} className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 border-l-4 border-[var(--rf-navy)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div>
                        <h3 className="font-bold text-[var(--rf-navy)] text-lg">{interview.job_title || 'Interview'}</h3>
                        <p className="text-sm text-[var(--rf-muted)] mb-2">{interview.company || 'Company'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {scheduleLabel}
                        </div>
                       </div>
                       <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/jobs/${interview.job_id}`)}
                          className="px-4 py-2 border border-gray-200 rounded-[var(--rf-radius-md)] text-sm font-semibold text-[var(--rf-navy)] hover:bg-gray-50"
                        >
                          View Job
                        </button>
                        <button
                          onClick={() => {
                            if (!meta?.link) {
                              toast.info('Interview link will appear here once scheduled by recruiter.');
                              return;
                            }
                            window.open(meta.link, '_blank', 'noopener,noreferrer');
                          }}
                          className="px-4 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] text-sm font-semibold hover:bg-[#00B548]"
                        >
                          {meta?.link ? 'Join Interview' : 'Join Waiting Room'}
                        </button>
                       </div>
                    </div>
                 )})
             ) : (
                !loading && <div className="text-center py-12 text-gray-500">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No upcoming interviews scheduled.</p>
                </div>
             )}
          </div>
        )}

        {activeTab === 'ondemand' && (
           <div className="grid gap-6">
               {!loading && onDemandInterviews.length > 0 ? (
                  onDemandInterviews.map((interview) => (
                    <div key={interview.id} className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 border-l-4 border-purple-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-[var(--rf-navy)] text-lg">{interview.job_title || 'On-demand interview'}</h3>
                        <p className="text-sm text-[var(--rf-muted)] mb-2">{interview.company || 'Company'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          Complete your prep and response steps
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/seeker/applications?status=shortlisted')}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-[var(--rf-radius-md)] text-sm font-semibold hover:bg-purple-700"
                      >
                        Continue <ArrowRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  ))
               ) : (
                !loading && <div className="text-center py-12 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No on-demand interviews pending.</p>
                </div>
               )}
           </div>
        )}
      </div>
    </div>
  );
}
