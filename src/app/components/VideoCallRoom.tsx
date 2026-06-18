import { useEffect, useRef, useState } from 'react';
import { X, Video, Mic, MicOff, VideoOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, onClose }: Props) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const offerRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const [status, setStatus] = useState<'starting' | 'waiting' | 'connected' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    let alive = true;

    async function flushCandidates() {
      for (const c of pendingCandidates.current) {
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingCandidates.current = [];
    }

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err: any) {
        if (!alive) return;
        setErrorMsg(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera or microphone permission was denied. Allow access in your browser settings and try again.'
            : 'Could not access camera or microphone. Please check your device.'
        );
        setStatus('error');
        return;
      }
      if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
        if (alive) setStatus('connected');
      };

      const channelId = `rf-video-${applicationId}`;
      const ch = supabase.channel(channelId, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = ch;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          ch.send({ type: 'broadcast', event: 'ice', payload: e.candidate.toJSON() });
        }
      };

      // Seeker handles incoming offer
      ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (isHost || !alive) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await flushCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ch.send({ type: 'broadcast', event: 'answer', payload: answer });
        } catch (e) { console.error('offer handling error', e); }
      });

      // Host handles incoming answer
      ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!isHost || !alive) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await flushCandidates();
        } catch (e) { console.error('answer handling error', e); }
      });

      // Queue ICE candidates until remote description is set
      ch.on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (!alive) return;
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
        } else {
          pendingCandidates.current.push(payload);
        }
      });

      // Host re-sends offer when anyone joins the channel (in case seeker was late)
      ch.on('presence', { event: 'join' }, () => {
        if (isHost && offerRef.current && !pc.currentRemoteDescription) {
          ch.send({ type: 'broadcast', event: 'offer', payload: offerRef.current });
        }
      });

      ch.subscribe(async (s) => {
        if (s !== 'SUBSCRIBED' || !alive) return;
        await ch.track({ role: isHost ? 'host' : 'seeker' });
        if (alive) setStatus('waiting');

        if (isHost) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            offerRef.current = offer;
            ch.send({ type: 'broadcast', event: 'offer', payload: offer });
          } catch (e) { console.error('create offer error', e); }
        }
      });
    }

    start();

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [applicationId, isHost]);

  function toggleMic() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  }
  function toggleCam() {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0d1117', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#0A2540', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Video size={16} color="#00C853" />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
            {jobTitle || 'Video Interview'}{candidateName ? ` — ${candidateName}` : ''}
          </span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500, color: '#fff',
            background: status === 'connected' ? '#00C853' : status === 'error' ? '#dc2626' : '#f59e0b',
          }}>
            {status === 'starting' ? 'Starting…'
              : status === 'waiting' ? `Waiting for ${isHost ? 'candidate' : 'interviewer'}…`
              : status === 'connected' ? 'Connected'
              : 'Error'}
          </span>
        </div>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <X size={13} /> End Call
        </button>
      </div>

      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
        {status === 'error' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
            <VideoOff size={48} color="#dc2626" />
            <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', maxWidth: 360, margin: 0 }}>{errorMsg}</p>
            <button onClick={onClose} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}>Close</button>
          </div>
        ) : (
          <>
            {/* Remote video */}
            <video ref={remoteRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'connected' ? 'block' : 'none' }} />

            {/* Waiting spinner */}
            {status !== 'connected' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff' }}>
                <Loader2 size={40} color="#00C853" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ margin: 0, fontSize: 15 }}>Waiting for {isHost ? 'candidate' : 'interviewer'} to join…</p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Share the interview link so they can connect</p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* Local video (picture-in-picture) */}
            <video
              ref={localRef}
              autoPlay
              muted
              playsInline
              style={{ position: 'absolute', bottom: 16, right: 16, width: 160, height: 120, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(255,255,255,0.25)', background: '#222', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
            />
          </>
        )}
      </div>

      {/* Controls */}
      {status !== 'error' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '12px 16px', background: '#0A2540', flexShrink: 0 }}>
          <button onClick={toggleMic} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: micOn ? 'rgba(255,255,255,0.12)' : '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {micOn ? <Mic size={15} /> : <MicOff size={15} />} {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button onClick={toggleCam} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: camOn ? 'rgba(255,255,255,0.12)' : '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            {camOn ? <Video size={15} /> : <VideoOff size={15} />} {camOn ? 'Stop Video' : 'Start Video'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 13 }}>
            End Call
          </button>
        </div>
      )}
    </div>
  );
}
