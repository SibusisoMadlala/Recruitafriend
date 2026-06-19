import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  MessageSquare, Hand, Users, Maximize2, Minimize2, Send, PhoneOff,
  Wifi, WifiOff, Copy, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';

interface ChatMsg { from: string; text: string; ts: number; }

// Full peer info kept in a ref (not serialisable to state)
type PeerInfo = {
  id: string;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  pendingIce: RTCIceCandidateInit[];
};

// Render state for each remote peer
type RenderPeer = {
  id: string;
  name: string;
  stream: MediaStream | null;
  connected: boolean;
  handRaised: boolean;
};

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

const MAX_PEERS = 3; // host + 3 = 4 total

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, onClose }: Props) {
  const { profile } = useAuth();
  const myName = profile?.name || (isHost ? 'Interviewer' : (candidateName || 'Candidate'));

  const localRef      = useRef<HTMLVideoElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const screenRef     = useRef<MediaStream | null>(null);
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myPeerId      = useRef(crypto.randomUUID());
  const peersRef      = useRef<Map<string, PeerInfo>>(new Map());
  const peerVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const offeredTo     = useRef(new Set<string>());
  const heardFrom     = useRef(new Set<string>());
  const hasConnected  = useRef(false);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);
  const myNameRef     = useRef(myName);
  myNameRef.current   = myName;

  const [status, setStatus]         = useState<'starting' | 'waiting' | 'connected' | 'reconnecting' | 'error'>('starting');
  const [errorMsg, setErrorMsg]     = useState('');
  const [renderPeers, setRenderPeers] = useState<RenderPeer[]>([]);
  const [micOn, setMicOn]           = useState(true);
  const [camOn, setCamOn]           = useState(true);
  const [screenOn, setScreenOn]     = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [panel, setPanel]           = useState<'none' | 'chat' | 'people'>('none');
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages]     = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]   = useState('');
  const [unread, setUnread]         = useState(0);
  const [quality, setQuality]       = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [duration, setDuration]     = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  const meetingLink = `${window.location.origin}/employer/join-call/${applicationId}`;

  // ─── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // ─── Quality check (first peer) ───────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(async () => {
      const first = Array.from(peersRef.current.values())[0];
      if (!first) return;
      try {
        const stats = await first.pc.getStats();
        let lost = 0, total = 0;
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') { lost = r.packetsLost ?? 0; total = r.packetsReceived ?? 0; }
        });
        setQuality(total > 0 && lost / (total + lost) < 0.05 ? 'good' : 'poor');
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [status]);

  // ─── Chat scroll + unread ─────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (panel !== 'chat') setUnread(u => u + 1);
  }, [messages]);
  useEffect(() => { if (panel === 'chat') setUnread(0); }, [panel]);

  // ─── Sync streams to video elements ───────────────────────────────────────
  useEffect(() => {
    for (const peer of renderPeers) {
      if (!peer.stream) continue;
      const el = peerVideoRefs.current.get(peer.id);
      if (el && el.srcObject !== peer.stream) { el.srcObject = peer.stream; el.play().catch(() => {}); }
    }
  }, [renderPeers]);

  // ─── Derive status from peer list ─────────────────────────────────────────
  useEffect(() => {
    if (status === 'starting' || status === 'error') return;
    const any = renderPeers.some(p => p.connected);
    if (any) { hasConnected.current = true; setStatus('connected'); }
    else if (hasConnected.current) setStatus('reconnecting');
  }, [renderPeers]);

  // ─── Main signaling effect ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const myId = myPeerId.current;

    async function start() {
      // Get TURN credentials and camera in parallel
      let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
      let stream: MediaStream;

      const [turnRes, mediaRes] = await Promise.allSettled([
        supabase.functions.invoke('get-turn'),
        navigator.mediaDevices.getUserMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }),
      ]);

      if (turnRes.status === 'fulfilled' && turnRes.value.data?.iceServers) {
        iceServers = turnRes.value.data.iceServers;
      }
      if (mediaRes.status === 'rejected') {
        if (!alive) return;
        const err = mediaRes.reason;
        setErrorMsg(err?.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Allow access in your browser settings.'
          : 'Could not access camera or microphone. Check your device.');
        setStatus('error');
        return;
      }
      stream = (mediaRes as PromiseFulfilledResult<MediaStream>).value;

      if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      iceServersRef.current = iceServers;
      if (localRef.current) { localRef.current.srcObject = stream; localRef.current.play().catch(() => {}); }

      const ch = supabase.channel(`rf-video-${applicationId}`, { config: { broadcast: { self: false } } });
      channelRef.current = ch;

      // ── Create a PeerConnection for one remote peer ────────────────────
      function initPeer(peerId: string, peerName: string): PeerInfo {
        const existing = peersRef.current.get(peerId);
        if (existing) return existing;

        const remoteStream = new MediaStream();
        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

        streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current!));

        pc.ontrack = (e) => {
          remoteStream.addTrack(e.track);
          const el = peerVideoRefs.current.get(peerId);
          if (el) { el.srcObject = remoteStream; el.play().catch(() => {}); }
          setRenderPeers(prev => prev.map(p =>
            p.id === peerId ? { ...p, connected: true, stream: remoteStream } : p
          ));
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            ch.send({ type: 'broadcast', event: 'rfice', payload: { from: myId, to: peerId, candidate: e.candidate.toJSON() } });
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed' && offeredTo.current.has(peerId)) {
            pc.createOffer({ iceRestart: true }).then(async offer => {
              await pc.setLocalDescription(offer);
              ch.send({ type: 'broadcast', event: 'rfoffer', payload: { from: myId, to: peerId, sdp: offer } });
            }).catch(() => {});
          }
        };

        const info: PeerInfo = { id: peerId, name: peerName, pc, stream: remoteStream, pendingIce: [] };
        peersRef.current.set(peerId, info);
        setRenderPeers(prev => [...prev.filter(p => p.id !== peerId), { id: peerId, name: peerName, stream: null, connected: false, handRaised: false }]);
        return info;
      }

      async function offerTo(peerId: string, peerName: string) {
        if (offeredTo.current.has(peerId)) return;
        if (peersRef.current.size >= MAX_PEERS) { toast.error('This call is full (max 4 people).'); return; }
        offeredTo.current.add(peerId);
        const info = initPeer(peerId, peerName);
        try {
          const offer = await info.pc.createOffer();
          await info.pc.setLocalDescription(offer);
          ch.send({ type: 'broadcast', event: 'rfoffer', payload: { from: myId, to: peerId, sdp: offer, peerName: myNameRef.current } });
        } catch {}
      }

      // ── Someone new joined ─────────────────────────────────────────────
      ch.on('broadcast', { event: 'rfhello' }, async ({ payload }) => {
        if (!alive) return;
        const { peerId, peerName } = payload as { peerId: string; peerName: string };
        if (peerId === myId) return;
        // Re-announce ourselves so newcomers know we exist (only once per peer)
        if (!heardFrom.current.has(peerId)) {
          heardFrom.current.add(peerId);
          ch.send({ type: 'broadcast', event: 'rfhello', payload: { peerId: myId, peerName: myNameRef.current } });
        }
        // Deterministic tiebreak: higher ID offers to lower ID — prevents WebRTC glare
        if (myId > peerId) await offerTo(peerId, peerName);
      });

      // ── Receive offer directed at us ───────────────────────────────────
      ch.on('broadcast', { event: 'rfoffer' }, async ({ payload }) => {
        if (!alive) return;
        const { from, to, sdp, peerName } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit; peerName?: string };
        if (to !== myId) return;
        if (peersRef.current.size >= MAX_PEERS && !peersRef.current.has(from)) {
          toast.error('Call is full.'); return;
        }
        const info = initPeer(from, peerName || 'Participant');
        try {
          await info.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const c of info.pendingIce) { try { await info.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
          info.pendingIce = [];
          const answer = await info.pc.createAnswer();
          await info.pc.setLocalDescription(answer);
          ch.send({ type: 'broadcast', event: 'rfanswer', payload: { from: myId, to: from, sdp: answer, peerName: myNameRef.current } });
        } catch {}
      });

      // ── Receive answer directed at us ──────────────────────────────────
      ch.on('broadcast', { event: 'rfanswer' }, async ({ payload }) => {
        if (!alive) return;
        const { from, to, sdp, peerName } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit; peerName?: string };
        if (to !== myId) return;
        const info = peersRef.current.get(from);
        // Update name if they told us
        if (info && peerName) setRenderPeers(prev => prev.map(p => p.id === from ? { ...p, name: peerName } : p));
        if (!info) return;
        try {
          await info.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const c of info.pendingIce) { try { await info.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
          info.pendingIce = [];
        } catch {}
      });

      // ── ICE candidates ─────────────────────────────────────────────────
      ch.on('broadcast', { event: 'rfice' }, async ({ payload }) => {
        if (!alive) return;
        const { from, to, candidate } = payload as { from: string; to: string; candidate: RTCIceCandidateInit };
        if (to !== myId) return;
        const info = peersRef.current.get(from);
        if (!info) return;
        if (info.pc.remoteDescription) {
          try { await info.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        } else {
          info.pendingIce.push(candidate);
        }
      });

      // ── Peer left ──────────────────────────────────────────────────────
      ch.on('broadcast', { event: 'rfleave' }, ({ payload }) => {
        if (!alive) return;
        const { peerId } = payload as { peerId: string };
        const info = peersRef.current.get(peerId);
        if (info) { info.pc.close(); peersRef.current.delete(peerId); }
        offeredTo.current.delete(peerId);
        heardFrom.current.delete(peerId);
        setRenderPeers(prev => prev.filter(p => p.id !== peerId));
      });

      // ── Presence: detect crashes/disconnects ───────────────────────────
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!alive) return;
        for (const p of leftPresences as any[]) {
          const peerId = p?.peerId;
          if (!peerId) continue;
          const info = peersRef.current.get(peerId);
          if (info) { info.pc.close(); peersRef.current.delete(peerId); }
          offeredTo.current.delete(peerId);
          heardFrom.current.delete(peerId);
          setRenderPeers(prev => prev.filter(r => r.id !== peerId));
        }
      });

      // ── Chat ───────────────────────────────────────────────────────────
      ch.on('broadcast', { event: 'rfchat' }, ({ payload }) => {
        if (!alive) return;
        setMessages(m => [...m, payload as ChatMsg]);
      });

      // ── Hand raise ─────────────────────────────────────────────────────
      ch.on('broadcast', { event: 'rfhand' }, ({ payload }) => {
        if (!alive) return;
        const { from, raised } = payload as { from: string; raised: boolean };
        setRenderPeers(prev => prev.map(p => p.id === from ? { ...p, handRaised: raised } : p));
      });

      // ── Subscribe & announce ───────────────────────────────────────────
      ch.subscribe(async (s) => {
        if (s !== 'SUBSCRIBED' || !alive) return;
        await ch.track({ peerId: myId, name: myNameRef.current });
        if (alive) setStatus('waiting');
        ch.send({ type: 'broadcast', event: 'rfhello', payload: { peerId: myId, peerName: myNameRef.current } });
      });
    }

    start();

    return () => {
      alive = false;
      channelRef.current?.send({ type: 'broadcast', event: 'rfleave', payload: { peerId: myPeerId.current } });
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(info => info.pc.close());
      peersRef.current.clear();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [applicationId]);

  // ─── Hand re-broadcast (so late joiners see it) ───────────────────────────
  useEffect(() => {
    if (!handRaised) return;
    const t = setInterval(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'rfhand', payload: { from: myPeerId.current, raised: true } });
    }, 3000);
    return () => clearInterval(t);
  }, [handRaised]);

  // ─── Controls ─────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  }, []);

  const toggleCam = useCallback(() => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  }, []);

  const toggleScreen = useCallback(async () => {
    if (screenOn) {
      screenRef.current?.getTracks().forEach(t => t.stop());
      screenRef.current = null;
      const camTrack = streamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        peersRef.current.forEach(async ({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(camTrack);
        });
        if (localRef.current) localRef.current.srcObject = streamRef.current;
      }
      setScreenOn(false);
    } else {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
        screenRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        peersRef.current.forEach(async ({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(screenTrack);
        });
        if (localRef.current) localRef.current.srcObject = screen;
        screenTrack.onended = () => toggleScreen();
        setScreenOn(true);
      } catch {}
    }
  }, [screenOn]);

  const toggleHand = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    channelRef.current?.send({ type: 'broadcast', event: 'rfhand', payload: { from: myPeerId.current, raised: next } });
  }, [handRaised]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !channelRef.current) return;
    const msg: ChatMsg = { from: myName, text, ts: Date.now() };
    channelRef.current.send({ type: 'broadcast', event: 'rfchat', payload: msg });
    setMessages(m => [...m, msg]);
    setChatInput('');
  }, [chatInput, myName]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(meetingLink).then(() => {
      setLinkCopied(true);
      toast.success('Meeting link copied! Share it with your team.');
      setTimeout(() => setLinkCopied(false), 2500);
    }).catch(() => toast.error('Could not copy link'));
  }, [meetingLink]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const Btn = (active: boolean, danger = false): React.CSSProperties => ({
    padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: danger ? '#dc2626' : active ? 'rgba(255,255,255,0.15)' : '#dc2626',
    color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, fontSize: 11, fontWeight: 500, minWidth: 56,
  });

  // Callback ref to set video srcObject when element mounts
  function peerVideoRef(el: HTMLVideoElement | null, peerId: string, stream: MediaStream | null) {
    if (el) {
      peerVideoRefs.current.set(peerId, el);
      if (stream && el.srcObject !== stream) { el.srcObject = stream; el.play().catch(() => {}); }
    } else {
      peerVideoRefs.current.delete(peerId);
    }
  }

  const connectedPeers = renderPeers.filter(p => p.connected);
  const anyHandRaised  = renderPeers.filter(p => p.handRaised);
  const useGrid        = connectedPeers.length >= 2;
  const gridCols       = connectedPeers.length + 1 <= 3 ? `repeat(${connectedPeers.length + 1}, 1fr)` : 'repeat(2, 1fr)';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0d1117', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#0A2540', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Video size={15} color="#00C853" />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
            {jobTitle || 'Video Interview'}{candidateName ? ` — ${candidateName}` : ''}
          </span>
          {status === 'connected' && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{fmt(duration)}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'connected' && (quality === 'good'
            ? <Wifi size={14} color="#00C853" />
            : quality === 'poor' ? <WifiOff size={14} color="#f59e0b" /> : null)}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500, color: '#fff', background: status === 'connected' ? '#00C853' : status === 'error' ? '#dc2626' : '#f59e0b' }}>
            {status === 'starting' ? 'Starting…'
              : status === 'waiting' ? `Waiting for ${isHost ? 'others' : 'interviewer'}…`
              : status === 'connected' ? `Live • ${connectedPeers.length + 1} people`
              : status === 'reconnecting' ? 'Reconnecting…'
              : 'Error'}
          </span>
          {isHost && (
            <button onClick={copyLink} title="Copy meeting link" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '5px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              {linkCopied ? <Check size={13} color="#00C853" /> : <Copy size={13} />}
              {linkCopied ? 'Copied!' : 'Share Link'}
            </button>
          )}
          <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }}>
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <X size={13} /> Leave
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
          {status === 'error' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
              <VideoOff size={48} color="#dc2626" />
              <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', maxWidth: 360, margin: 0 }}>{errorMsg}</p>
              <button onClick={onClose} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}>Close</button>
            </div>

          ) : useGrid ? (
            /* ── Grid layout (3+ people) ── */
            <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: gridCols, gridAutoRows: '1fr', gap: 4, padding: 4, boxSizing: 'border-box' }}>
              {connectedPeers.map(peer => (
                <div key={peer.id} style={{ position: 'relative', background: '#222', borderRadius: 8, overflow: 'hidden', minHeight: 0 }}>
                  <video
                    ref={el => peerVideoRef(el, peer.id, peer.stream)}
                    autoPlay playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.55)', padding: '2px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                    {peer.name}{peer.handRaised ? ' ✋' : ''}
                  </div>
                </div>
              ))}
              {/* Local tile */}
              <div style={{ position: 'relative', background: '#1a1a1a', borderRadius: 8, overflow: 'hidden', minHeight: 0 }}>
                <video ref={localRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.55)', padding: '2px 8px', borderRadius: 6 }}>
                  {screenOn ? '🖥 Sharing' : `${myName} (You)`}
                </div>
                {!micOn && (
                  <div style={{ position: 'absolute', top: 8, right: 8, background: '#dc2626', borderRadius: '50%', padding: 4 }}>
                    <MicOff size={12} color="#fff" />
                  </div>
                )}
                {handRaised && (
                  <div style={{ position: 'absolute', top: 8, left: 8, background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>✋</div>
                )}
              </div>
            </div>

          ) : (
            /* ── Standard 1-on-1 layout (or waiting) ── */
            <>
              {/* Remote video */}
              {connectedPeers.length === 1 && (
                <>
                  <video
                    ref={el => peerVideoRef(el, connectedPeers[0].id, connectedPeers[0].stream)}
                    autoPlay playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', bottom: 90, left: 16, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>
                    {connectedPeers[0].name}
                  </div>
                  {connectedPeers[0].handRaised && (
                    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#fff', padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: 13 }}>
                      ✋ {connectedPeers[0].name} raised their hand
                    </div>
                  )}
                </>
              )}

              {/* Waiting overlay */}
              {connectedPeers.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff' }}>
                  <div style={{ width: 48, height: 48, border: '4px solid #00C853', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rfSpin 1s linear infinite' }} />
                  <p style={{ margin: 0, fontSize: 15 }}>
                    {status === 'reconnecting' ? 'Reconnecting…' : `Waiting for ${isHost ? 'others to join' : 'the interviewer'}…`}
                  </p>
                  {isHost && status === 'waiting' && (
                    <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,200,83,0.15)', border: '1px solid #00C853', color: '#00C853', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      <Copy size={14} />
                      {linkCopied ? 'Copied!' : 'Copy invite link'}
                    </button>
                  )}
                  <style>{`@keyframes rfSpin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {/* Global hand-raise notifications (for grid too) */}
              {anyHandRaised.length > 0 && !useGrid && (
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#fff', padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: 13 }}>
                  ✋ {anyHandRaised.map(p => p.name).join(', ')} raised their hand
                </div>
              )}

              {handRaised && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: '#f59e0b', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  ✋ Your hand is raised
                </div>
              )}

              {/* Local PIP */}
              <div style={{ position: 'absolute', bottom: 80, right: 16, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', background: '#222' }}>
                <video ref={localRef} autoPlay muted playsInline style={{ width: 160, height: 120, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 6, color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 4 }}>
                  {screenOn ? '🖥 Sharing' : `${myName} (You)`}
                </div>
                {!micOn && (
                  <div style={{ position: 'absolute', top: 4, right: 4, background: '#dc2626', borderRadius: '50%', padding: 3 }}>
                    <MicOff size={10} color="#fff" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        {panel !== 'none' && (
          <div style={{ width: 280, background: '#1a1f2e', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{panel === 'chat' ? 'Chat' : 'Participants'}</span>
              <button onClick={() => setPanel('none')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            {panel === 'people' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Local (me) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#00C853', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {myName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 500 }}>{myName} (You)</p>
                      <p style={{ margin: 0, color: '#00C853', fontSize: 11 }}>In call</p>
                    </div>
                  </div>
                  {/* Remote peers */}
                  {renderPeers.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.connected ? '#00C853' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {p.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 500 }}>{p.name}{p.handRaised ? ' ✋' : ''}</p>
                        <p style={{ margin: 0, color: p.connected ? '#00C853' : '#888', fontSize: 11 }}>{p.connected ? 'In call' : 'Connecting…'}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Share link section */}
                {isHost && (
                  <div style={{ marginTop: 20, padding: 12, background: 'rgba(0,200,83,0.08)', borderRadius: 8, border: '1px solid rgba(0,200,83,0.2)' }}>
                    <p style={{ margin: '0 0 6px', color: '#00C853', fontSize: 12, fontWeight: 600 }}>Invite to this call</p>
                    <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Share this link with team members</p>
                    <button onClick={copyLink} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#00C853', border: 'none', color: '#fff', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                      {linkCopied ? 'Link Copied!' : 'Copy Meeting Link'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {panel === 'chat' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {messages.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>No messages yet. Say hello!</p>
                  )}
                  {messages.map((m, i) => {
                    const mine = m.from === myName;
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{m.from}</span>
                        <div style={{ background: mine ? '#00C853' : 'rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px', fontSize: 13, maxWidth: '90%', wordBreak: 'break-word' }}>
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Type a message…"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={sendChat} style={{ background: '#00C853', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {status !== 'error' && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#0A2540', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={toggleMic} style={Btn(micOn)}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button onClick={toggleCam} style={Btn(camOn)}>
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
            {camOn ? 'Cam Off' : 'Cam On'}
          </button>
          <button onClick={toggleScreen} style={Btn(!screenOn)}>
            {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
            {screenOn ? 'Stop Share' : 'Share Screen'}
          </button>
          <button onClick={toggleHand} style={{ ...Btn(!handRaised), background: handRaised ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: 16 }}>✋</span>
            {handRaised ? 'Lower Hand' : 'Raise Hand'}
          </button>
          <button onClick={() => setPanel(p => p === 'chat' ? 'none' : 'chat')} style={{ ...Btn(panel === 'chat'), position: 'relative' }}>
            <MessageSquare size={18} />
            Chat
            {unread > 0 && panel !== 'chat' && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button onClick={() => setPanel(p => p === 'people' ? 'none' : 'people')} style={{ ...Btn(panel === 'people'), position: 'relative' }}>
            <Users size={18} />
            People
            {renderPeers.length > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: '#00C853', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {renderPeers.length + 1}
              </span>
            )}
          </button>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          <button onClick={onClose} style={{ ...Btn(true, true), background: '#dc2626', minWidth: 64 }}>
            <PhoneOff size={18} />
            End Call
          </button>
        </div>
      )}
    </div>
  );
}
