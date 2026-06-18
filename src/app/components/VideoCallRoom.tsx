import { useEffect, useRef, useState } from 'react';
import { X, Video, Mic, MicOff, VideoOff, Loader2, PhoneOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean; // employer = true (sends offer), seeker = false (answers)
  onClose: () => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

type Status = 'getting-media' | 'waiting' | 'connecting' | 'connected' | 'error';

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, onClose }: Props) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const [status, setStatus] = useState<Status>('getting-media');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const role = isHost ? 'host' : 'guest';
  const other = isHost ? 'guest' : 'host';

  useEffect(() => {
    let destroyed = false;

    async function start() {
      // 1. Get local camera/mic
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        if (destroyed) return;
        setStatus('error');
        setErrorMsg('Could not access camera/microphone. Please check browser permissions.');
        return;
      }
      if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      if (localRef.current) { localRef.current.srcObject = stream; }

      // 2. Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (remoteRef.current && e.streams[0]) {
          remoteRef.current.srcObject = e.streams[0];
          setStatus('connected');
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setStatus('error');
          setErrorMsg('Connection failed. Both parties need to have the call open at the same time.');
        }
      };

      // 3. Supabase Realtime channel for signaling
      const channel = supabase.channel(`rf-interview-${applicationId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'ice', candidate: e.candidate.toJSON() } });
        }
      };

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || payload.from !== other) return;

        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          // Flush any buffered ICE candidates
          for (const c of pendingCandidates.current) await pc.addIceCandidate(c);
          pendingCandidates.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'answer', sdp: pc.localDescription } });
          setStatus('connecting');
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === 'ice') {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(payload.candidate);
          } else {
            pendingCandidates.current.push(payload.candidate);
          }
        } else if (payload.type === 'ready' && isHost) {
          // Guest is ready — (re)send offer
          await sendOffer(pc, channel);
        }
      });

      setStatus('waiting');

      await channel.subscribe(async (state) => {
        if (state !== 'SUBSCRIBED') return;
        if (isHost) {
          await sendOffer(pc, channel);
        } else {
          // Announce readiness so host resends offer if they joined first
          channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'ready' } });
        }
      });
    }

    start();

    return () => {
      destroyed = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      channelRef.current?.unsubscribe();
    };
  }, [applicationId, isHost]);

  async function sendOffer(pc: RTCPeerConnection, channel: ReturnType<typeof supabase.channel>) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'offer', sdp: pc.localDescription } });
    setStatus('waiting');
  }

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  const statusLabel: Record<Status, string> = {
    'getting-media': 'Starting camera…',
    waiting: isHost ? 'Waiting for candidate to join…' : 'Waiting for employer to join…',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: errorMsg,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0d1117', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: '#0A2540', color: 'white', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Video style={{ width: '1.25rem', height: '1.25rem', color: '#00C853' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {jobTitle || 'Video Interview'}{candidateName ? ` — ${candidateName}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: status === 'connected' ? '#00C853' : '#aaa' }}>
            {statusLabel[status]}
          </span>
        </div>
      </div>

      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', background: '#0d1117', overflow: 'hidden' }}>
        {/* Remote video (full screen) */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'connected' ? 'block' : 'none' }}
        />

        {/* Waiting overlay */}
        {status !== 'connected' && status !== 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '1rem' }}>
            <Loader2 style={{ width: '2.5rem', height: '2.5rem', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{statusLabel[status]}</p>
            <p style={{ fontSize: '0.8rem', color: '#aaa' }}>Make sure the other person has the call open</p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#ff4444' }}>{errorMsg}</p>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          style={{ position: 'absolute', bottom: '5rem', right: '1rem', width: '120px', height: '90px', objectFit: 'cover', borderRadius: '0.5rem', border: '2px solid #00C853', background: '#111' }}
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', background: '#0A2540', flexShrink: 0 }}>
        <button
          onClick={toggleMic}
          style={{ background: micOn ? 'rgba(255,255,255,0.15)' : '#ff4444', border: 'none', color: 'white', borderRadius: '50%', width: '3rem', height: '3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={micOn ? 'Mute mic' : 'Unmute mic'}
        >
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>

        <button
          onClick={onClose}
          style={{ background: '#ff3b30', border: 'none', color: 'white', borderRadius: '50%', width: '3.5rem', height: '3.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="End call"
        >
          <PhoneOff size={20} />
        </button>

        <button
          onClick={toggleCam}
          style={{ background: camOn ? 'rgba(255,255,255,0.15)' : '#ff4444', border: 'none', color: 'white', borderRadius: '50%', width: '3rem', height: '3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={camOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
