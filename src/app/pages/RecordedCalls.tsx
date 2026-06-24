import { useEffect, useState } from 'react';
import { Video, Loader2, Play, Trash2, Calendar, User, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../context/useAuth';

type Recording = {
  id: string;
  created_at: string;
  recorded_at: string;
  application_id: string;
  job_title: string | null;
  candidate_name: string | null;
  video_url: string;
  storage_path: string;
};

export default function RecordedCalls() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('call_recordings')
      .select('*')
      .eq('employer_id', user!.id)
      .order('recorded_at', { ascending: false });
    if (error) {
      toast.error('Failed to load recordings');
    } else {
      setRecordings(data ?? []);
    }
    setLoading(false);
  }

  async function deleteRecording(rec: Recording) {
    if (!confirm('Delete this recording? This cannot be undone.')) return;
    setDeleting(rec.id);
    try {
      await supabase.storage.from('call-recordings').remove([rec.storage_path]);
      await supabase.from('call_recordings').delete().eq('id', rec.id);
      setRecordings(prev => prev.filter(r => r.id !== rec.id));
      if (playingId === rec.id) setPlayingId(null);
      toast.success('Recording deleted');
    } catch {
      toast.error('Failed to delete recording');
    } finally {
      setDeleting(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0A2540] text-white p-8 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <Video className="w-7 h-7 text-[#00C853]" />
          <h1 className="text-2xl font-bold">Recorded Calls</h1>
        </div>
        <p className="text-gray-400 text-sm">Interview recordings saved during video calls — both participants visible.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
          <Loader2 className="w-6 h-6 animate-spin text-[#0A2540]" />
          <span className="ml-3 text-sm text-gray-500">Loading recordings…</span>
        </div>
      ) : recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-gray-100">
          <div className="bg-gray-50 p-5 rounded-full mb-4">
            <Video className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="font-bold text-[#0A2540] text-lg mb-1">No recordings yet</h3>
          <p className="text-gray-400 text-sm text-center max-w-xs">
            Start a video interview and click <strong>Record</strong> — the recording will be saved here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recordings.map(rec => (
            <div key={rec.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-red-50 p-2 rounded-lg flex-shrink-0">
                    <Video className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {rec.candidate_name && (
                        <span className="flex items-center gap-1 text-sm font-semibold text-[#0A2540]">
                          <User className="w-3.5 h-3.5" /> {rec.candidate_name}
                        </span>
                      )}
                      {rec.job_title && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Briefcase className="w-3 h-3" /> {rec.job_title}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <Calendar className="w-3 h-3" /> {formatDate(rec.recorded_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={() => setPlayingId(playingId === rec.id ? null : rec.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0A2540] text-white text-sm font-medium hover:bg-[#0d2f57] transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    {playingId === rec.id ? 'Close' : 'Play'}
                  </button>
                  <button
                    onClick={() => deleteRecording(rec)}
                    disabled={deleting === rec.id}
                    className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
                  >
                    {deleting === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {playingId === rec.id && (
                <div className="border-t border-gray-100 bg-black">
                  <video
                    src={rec.video_url}
                    controls
                    autoPlay
                    className="w-full max-h-[480px] object-contain"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
