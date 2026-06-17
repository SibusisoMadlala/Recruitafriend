import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Video, CheckCircle, Loader2, ChevronRight, RotateCcw, Play, Square, Upload, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiCall, supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';

interface ScreeningQuestion {
  id?: string | number;
  prompt: string;
  duration?: string;
}

interface VideoAnswer {
  question_id?: string | number;
  question: string;
  video_url: string;
  duration?: number;
}

type RecordingState = 'idle' | 'countdown' | 'recording' | 'preview' | 'uploading' | 'done';

export default function VideoAssessment() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [answers, setAnswers] = useState<VideoAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    loadApplication();
    return () => stopStream();
  }, []);

  async function loadApplication() {
    try {
      const { application: app } = await apiCall(`/seeker/applications/${applicationId}`, { requireAuth: true });
      setApplication(app);
      const qs: ScreeningQuestion[] = app?.job?.screening_questions || [];
      setQuestions(qs);
      // Pre-populate existing answers
      if (app?.video_answers?.length) {
        setAnswers(app.video_answers);
        // If all answered already, show submitted state
        if (app.video_answers.length >= qs.length && qs.length > 0) {
          setSubmitted(true);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      beginCountdown();
    } catch {
      toast.error('Could not access camera/microphone. Please check browser permissions.');
    }
  }

  function beginCountdown() {
    setCountdown(3);
    setRecordingState('countdown');
    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count === 0) {
        clearInterval(timer);
        startRecording();
      }
    }, 1000);
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      blobRef.current = new Blob(chunksRef.current, { type: 'video/webm' });
      if (previewRef.current) {
        previewRef.current.src = URL.createObjectURL(blobRef.current);
      }
      setRecordingState('preview');
    };
    recorder.start(1000);
    setRecordingSeconds(0);
    setRecordingState('recording');
    recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
  }

  function stopRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function retake() {
    blobRef.current = null;
    setRecordingState('idle');
  }

  async function uploadAndSave() {
    if (!blobRef.current || !user) return;
    setRecordingState('uploading');

    const question = questions[currentIndex];
    const fileName = `${user.id}/${applicationId}/q${currentIndex + 1}_${Date.now()}.webm`;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('interview-videos')
        .upload(fileName, blobRef.current, { contentType: 'video/webm', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('interview-videos')
        .getPublicUrl(uploadData.path);

      const newAnswer: VideoAnswer = {
        question_id: question.id ?? currentIndex,
        question: question.prompt,
        video_url: publicUrl,
        duration: recordingSeconds,
      };

      const updatedAnswers = [...answers.filter(a => a.question_id !== newAnswer.question_id), newAnswer];
      setAnswers(updatedAnswers);

      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(currentIndex + 1);
        setRecordingState('idle');
        blobRef.current = null;
      } else {
        // All questions answered — save to server
        setSaving(true);
        await apiCall(`/applications/${applicationId}/video-answers`, {
          requireAuth: true,
          method: 'PUT',
          body: JSON.stringify({ video_answers: updatedAnswers }),
        });
        setSubmitted(true);
        toast.success('Video assessment submitted!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed. Please try again.');
      setRecordingState('preview');
    } finally {
      setSaving(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--rf-green)]" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p>Assessment not found.</p>
        <button onClick={() => navigate('/seeker/interviews')} className="mt-4 text-[var(--rf-green)] hover:underline text-sm">
          Back to Interviews
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <Video className="w-12 h-12 mx-auto text-gray-300" />
        <h2 className="text-xl font-bold text-[var(--rf-navy)]">No video questions</h2>
        <p className="text-gray-500 text-sm">This job doesn't have video screening questions.</p>
        <button onClick={() => navigate('/seeker/interviews')} className="text-[var(--rf-green)] hover:underline text-sm">
          Back to Interviews
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <CheckCircle className="w-16 h-16 mx-auto text-[var(--rf-green)]" />
        <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Assessment Submitted</h2>
        <p className="text-gray-500">Your video answers have been sent to the employer. Good luck!</p>
        <button
          onClick={() => navigate('/seeker/interviews')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] text-sm font-semibold hover:bg-[#00B548]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Interviews
        </button>
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/seeker/interviews')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--rf-navy)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Interviews
        </button>
        <h1 className="text-2xl font-bold text-[var(--rf-navy)]">Video Assessment</h1>
        <p className="text-sm text-gray-500">{application.job?.title} · {application.company}</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < currentIndex
                ? 'bg-[var(--rf-green)]'
                : i === currentIndex
                ? 'bg-[var(--rf-navy)]'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400">Question {currentIndex + 1} of {questions.length}</p>

      {/* Question card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-[var(--rf-navy)] mb-1">Question {currentIndex + 1}</h2>
        <p className="text-gray-700 text-sm leading-relaxed">{question.prompt}</p>
        {question.duration && (
          <p className="text-xs text-gray-400 mt-2">Suggested response: {question.duration}</p>
        )}
      </div>

      {/* Recording area */}
      <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
        {(recordingState === 'idle' || recordingState === 'countdown' || recordingState === 'recording') && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${recordingState === 'idle' ? 'hidden' : ''}`}
          />
        )}

        {recordingState === 'preview' || recordingState === 'uploading' ? (
          <video
            ref={previewRef}
            controls
            playsInline
            className="w-full h-full object-cover"
          />
        ) : null}

        {recordingState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4">
            <Video className="w-12 h-12 opacity-40" />
            <p className="text-sm opacity-60">Camera preview will appear here</p>
          </div>
        )}

        {recordingState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-white text-7xl font-bold animate-pulse">{countdown}</span>
          </div>
        )}

        {recordingState === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            REC {formatTime(recordingSeconds)}
          </div>
        )}

        {recordingState === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-white text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Uploading...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {recordingState === 'idle' && (
          <button
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[#00B548]"
          >
            <Play className="w-4 h-4" /> Start Recording
          </button>
        )}

        {recordingState === 'recording' && (
          <button
            onClick={stopRecording}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-red-700"
          >
            <Square className="w-4 h-4" /> Stop Recording
          </button>
        )}

        {recordingState === 'preview' && (
          <>
            <button
              onClick={retake}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-[var(--rf-radius-md)] text-sm font-semibold text-[var(--rf-navy)] hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" /> Retake
            </button>
            <button
              onClick={uploadAndSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--rf-navy)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[#081f36] disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {currentIndex + 1 < questions.length ? (
                <>Save & Next <ChevronRight className="w-4 h-4" /></>
              ) : (
                'Submit Assessment'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
