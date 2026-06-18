import { useEffect, useRef, useState } from 'react';
import { X, Video, Mic, MicOff, VideoOff, Loader2, PhoneOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  // Free TURN server for users behind strict NAT (mobile networks)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

type Status = 'getting-media' | 'waiting' | 'connecting' | 'connected' | 'error';

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, onClose }: Props) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const offerSentRef = useRef(false);

  const [status, setStatus] = useState<Status>('getting-media');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const role = isHost ? 'host' : 'guest';
  const other = isHost ? 'guest' : 'host';
  const channelName = `rf-interview-${applicationId}`;

  useEffect(() => {
    let destroyed = false;

    async function start() {
      // Get camera + mic
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err: any) {
        if (destroyed) return;
        const msg = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Camera/microphone access was denied. Tap the lock icon in your browser address bar and allow access, then try again.'
          : 'Could not access camera or microphone. Make sure no other app is using them.';
        setErrorMsg(msg);
        setStatus('error');
        return;
      }
      if (destroyed) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      if (localRef.current) { localRef.current.srcObject = stream; }

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (destroyed) return;
        if (remoteRef.current && e.streams[0]) {
          remoteRef.current.srcObject = e.streams[0];
          setStatus('connected');
        }
      };

      pc.onconnectionstatechange = () => {
        if (destroyed) return;
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setStatus('waiting');
        }
      };

      // Set up Supabase Realtime signaling channel
      const channel = supabase.channel(channelName);
      channelRef.current = channel;

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: role, type: 'ice', candidate: e.candidate.toJSON() },
          });
        }
      };

      channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
        if (!payload || payload.from !== other || !pcRef.current) return;
        const p = pcRef.current;

        try {
          if (payload.type === 'offer' && !isHost) {
            await p.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            for (const c of pendingCandidates.current) await p.addIceCandidate(new RTCIceCandidate(c));
            pendingCandidates.current = [];
            const answer = await p.createAnswer();
            await p.setLocalDescription(answer);
            channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'answer', sdp: p.localDescription } });
            setStatus('connecting');
          } else if (payload.type === 'answer' && isHost) {
            await p.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } else if (payload.type === 'ice') {
            if (p.remoteDescription) {
              await p.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              pendingCandidates.current.push(payload.candidate);
            }
          } else if (payload.type === 'ready' && isHost) {
            // Guest signalled they're ready — resend offer
            await doOffer(p, channel);
          }
        } catch (e) {
          console.error('Signal handling error:', e);
        }
      });

      setStatus('waiting');

      channel.subscribe((state: string) => {
        if (state === 'SUBSCRIBED') {
          if (isHost) {
            doOffer(pc, channel);
          } else {
            // Tell host we're here
            channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'ready' } });
          }
        }
      });
    }

    async function doOffer(pc: RTCPeerConnection, channel: any) {
      if (offerSentRef.current) return;
      offerSentRef.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: 'broadcast', event: 'signal', payload: { from: role, type: 'offer', sdp: pc.localDescription } });
      } catch (e) {
        offerSentRef.current = false;
        console.error('Offer error:', e);
      }
    }

    start();

    return () => {
      destroyed = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      channelRef.current?.unsubscribe();
    };
  }, [applicationId]);

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
    error: '',
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
        <span style={{ fontSize: '0.75rem', color: status === 'connected' ? '#00C853' : '#aaa' }}>
          {status !== 'error' ? statusLabel[status] : ''}
        </span>
      </div>

      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', background: '#0d1117', overflow: 'hidden' }}>
        <video ref={remoteRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'connected' ? 'block' : 'none' }} />

        {status === 'error' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#ff6b6b', maxWidth: '320px', lineHeight: 1.5 }}>{errorMsg}</p>
            <button onClick={onClose} style={{ background: '#00C853', border: 'none', color: 'white', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Close</button>
          </div>
        ) : status !== 'connected' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '1rem' }}>
            <Loader2 style={{ width: '2.5rem', height: '2.5rem', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{statusLabel[status]}</p>
            {status === 'waiting' && (
              <p style={{ fontSize: '0.8rem', color: '#aaa' }}>Both people need to have the call open</p>
            )}
          </div>
        ) : null}

        {/* Local preview (PiP) */}
        {status !== 'error' && (
          <video ref={localRef} autoPlay muted playsInline style={{ position: 'absolute', bottom: '5rem', right: '1rem', width: '120px', height: '90px', objectFit: 'cover', borderRadius: '0.5rem', border: '2px solid #00C853', background: '#111' }} />
        )}
      </div>

      {/* Controls */}
      {status !== 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem', background: '#0A2540', flexShrink: 0 }}>
          <button onClick={toggleMic} style={{ background: micOn ? 'rgba(255,255,255,0.15)' : '#ff4444', border: 'none', color: 'white', borderRadius: '50%', width: '3rem', height: '3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={onClose} style={{ background: '#ff3b30', border: 'none', color: 'white', borderRadius: '50%', width: '3.5rem', height: '3.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhoneOff size={20} />
          </button>
          <button onClick={toggleCam} style={{ background: camOn ? 'rgba(255,255,255,0.15)' : '#ff4444', border: 'none', color: 'white', borderRadius: '50%', width: '3rem', height: '3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
