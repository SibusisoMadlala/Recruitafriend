import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  MessageSquare, Hand, Users, Maximize2, Minimize2, Send, PhoneOff,
  Wifi, WifiOff,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatMsg { from: string; text: string; ts: number; }
interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, onClose }: Props) {
  const localRef    = useRef<HTMLVideoElement>(null);
  const remoteRef   = useRef<HTMLVideoElement>(null);
  const pcRef       = useRef<RTCPeerConnection | null>(null);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const screenRef   = useRef<MediaStream | null>(null);
  const offerRef    = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIce  = useRef<RTCIceCandidateInit[]>([]);
  const remoteStream = useRef<MediaStream>(new MediaStream());
  const chatEndRef  = useRef<HTMLDivElement>(null);

  const [status, setStatus]     = useState<'starting' | 'waiting' | 'connected' | 'reconnecting' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [micOn, setMicOn]       = useState(true);
  const [camOn, setCamOn]       = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [handRaised, setHandRaised]       = useState(false);
  const [remoteHandRaised, setRemoteHandRaised] = useState(false);
  const [panel, setPanel]       = useState<'none' | 'chat' | 'people'>('none');
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unread, setUnread]     = useState(0);
  const [quality, setQuality]   = useState<'good' | 'poor' | 'unknown'>('unknown');
  const [duration, setDuration] = useState(0);
  const [remoteJoined, setRemoteJoined] = useState(false);

  const myName     = isHost ? 'Interviewer' : (candidateName || 'Candidate');
  const remoteName = isHost ? (candidateName || 'Candidate') : 'Interviewer';

  // Timer
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // Retry play when status becomes connected
  useEffect(() => {
    if (status === 'connected' && remoteRef.current?.srcObject) {
      remoteRef.current.play().catch(() => {});
    }
  }, [status]);

  // Quality check
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        let lost = 0, total = 0;
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            lost  = r.packetsLost  ?? 0;
            total = r.packetsReceived ?? 0;
          }
        });
        setQuality(total > 0 && lost / (total + lost) < 0.05 ? 'good' : 'poor');
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [status]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (panel !== 'chat') setUnread(u => u + 1);
  }, [messages]);

  useEffect(() => { if (panel === 'chat') setUnread(0); }, [panel]);

  async function flushIce() {
    for (const c of pendingIce.current) {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIce.current = [];
  }

  useEffect(() => {
    let alive = true;

    async function start() {
      // Fetch TURN credentials and camera in parallel — no extra wait time
      let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
      let stream: MediaStream;
      try {
        const [turnResult, mediaResult] = await Promise.allSettled([
          supabase.functions.invoke('get-turn'),
          navigator.mediaDevices.getUserMedia({
            video: true,
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          }),
        ]);
        if (turnResult.status === 'fulfilled' && turnResult.value.data?.iceServers) {
          iceServers = turnResult.value.data.iceServers;
        }
        if (mediaResult.status === 'rejected') {
          const err = mediaResult.reason;
          if (!alive) return;
          setErrorMsg(
            err?.name === 'NotAllowedError'
              ? 'Camera/microphone permission denied. Allow access in your browser settings and try again.'
              : 'Could not access camera or microphone. Check your device and try again.'
          );
          setStatus('error');
          return;
        }
        stream = (mediaResult as PromiseFulfilledResult<MediaStream>).value;
      } catch (err: any) {
        if (!alive) return;
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? 'Camera/microphone permission denied. Allow access in your browser settings and try again.'
            : 'Could not access camera or microphone. Check your device and try again.'
        );
        setStatus('error');
        return;
      }
      if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (localRef.current) { localRef.current.srcObject = stream; localRef.current.play().catch(() => {}); }

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // Build remote stream track-by-track
      pc.ontrack = (e) => {
        remoteStream.current.addTrack(e.track);
        if (remoteRef.current) {
          remoteRef.current.srcObject = remoteStream.current;
          remoteRef.current.play().catch(() => {});
        }
        if (alive) { setStatus('connected'); setRemoteJoined(true); }
      };

      // ICE restart is wired up after ch is created (needs to send a new offer)

      const ch = supabase.channel(`rf-video-${applicationId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = ch;

      pc.onicecandidate = (e) => {
        if (e.candidate) ch.send({ type: 'broadcast', event: 'ice', payload: e.candidate.toJSON() });
      };

      ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (isHost || !alive) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await flushIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ch.send({ type: 'broadcast', event: 'answer', payload: answer });
          // If this was a restart offer, we're reconnecting
          if (alive && (payload as RTCSessionDescriptionInit).sdp?.includes('ice-pwd')) {
            setStatus('reconnecting');
          }
        } catch (e) { console.error('offer error', e); }
      });

      ch.on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!isHost || !alive) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await flushIce();
        } catch (e) { console.error('answer error', e); }
      });

      ch.on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (!alive) return;
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
        } else {
          pendingIce.current.push(payload);
        }
      });

      ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (!alive) return;
        setMessages(m => [...m, payload as ChatMsg]);
      });

      ch.on('broadcast', { event: 'hand' }, ({ payload }) => {
        if (!alive) return;
        setRemoteHandRaised((payload as any).raised);
      });

      // ICE restart — host creates a new offer when connection drops
      let iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          if (iceRestartTimer) { clearTimeout(iceRestartTimer); iceRestartTimer = null; }
          if (alive) setStatus('connected');
        } else if (state === 'disconnected') {
          if (alive) setStatus('reconnecting');
          // Give it 4s to self-heal before forcing a restart
          iceRestartTimer = setTimeout(async () => {
            if (!alive || pc.iceConnectionState !== 'disconnected') return;
            if (isHost) {
              try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                offerRef.current = offer;
                ch.send({ type: 'broadcast', event: 'offer', payload: offer });
              } catch {}
            }
          }, 4000);
        } else if (state === 'failed') {
          if (alive) setStatus('reconnecting');
          if (isHost) {
            pc.createOffer({ iceRestart: true }).then(async offer => {
              await pc.setLocalDescription(offer);
              offerRef.current = offer;
              ch.send({ type: 'broadcast', event: 'offer', payload: offer });
            }).catch(() => {});
          }
        }
      };

      // Candidate sends 'ready' → host resends offer (fixes timing race)
      ch.on('broadcast', { event: 'ready' }, () => {
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
        } else {
          ch.send({ type: 'broadcast', event: 'ready', payload: {} });
        }
      });
    }

    start();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [applicationId, isHost]);

  const toggleMic = useCallback(() => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); }
  }, []);

  const toggleCam = useCallback(() => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  }, []);

  const toggleScreen = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (screenOn) {
      screenRef.current?.getTracks().forEach(t => t.stop());
      screenRef.current = null;
      const camTrack = streamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
        if (localRef.current) localRef.current.srcObject = streamRef.current;
      }
      setScreenOn(false);
    } else {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
        screenRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        if (localRef.current) localRef.current.srcObject = screen;
        screenTrack.onended = () => toggleScreen();
        setScreenOn(true);
      } catch {}
    }
  }, [screenOn]);

  const toggleHand = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    channelRef.current?.send({ type: 'broadcast', event: 'hand', payload: { raised: next } });
  }, [handRaised]);

  // Re-broadcast hand state every 3s so late joiners / reconnects always see it
  useEffect(() => {
    if (!handRaised) return;
    const t = setInterval(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'hand', payload: { raised: true } });
    }, 3000);
    return () => clearInterval(t);
  }, [handRaised]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || !channelRef.current) return;
    const msg: ChatMsg = { from: myName, text, ts: Date.now() };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
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

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const BtnStyle = (active: boolean, danger = false): React.CSSProperties => ({
    padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: danger ? '#dc2626' : active ? 'rgba(255,255,255,0.15)' : '#dc2626',
    color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, fontSize: 11, fontWeight: 500, minWidth: 56,
  });

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
          {status === 'connected' && (
            quality === 'good'
              ? <Wifi size={14} color="#00C853" />
              : quality === 'poor' ? <WifiOff size={14} color="#f59e0b" /> : null
          )}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500, color: '#fff', background: status === 'connected' ? '#00C853' : status === 'error' ? '#dc2626' : '#f59e0b' }}>
            {status === 'starting' ? 'Starting…' : status === 'waiting' ? `Waiting for ${isHost ? 'candidate' : 'interviewer'}…` : status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting…' : 'Error'}
          </span>
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
        <div style={{ flex: 1, position: 'relative', background: '#111', overflow: 'hidden' }}>
          {status === 'error' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
              <VideoOff size={48} color="#dc2626" />
              <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', maxWidth: 360, margin: 0 }}>{errorMsg}</p>
              <button onClick={onClose} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}>Close</button>
            </div>
          ) : (
            <>
              {/* Remote video — always mounted so autoplay triggers when srcObject is set */}
              <video ref={remoteRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: status === 'connected' ? 1 : 0 }} />

              {status === 'connected' && (
                <div style={{ position: 'absolute', bottom: 90, left: 16, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, padding: '3px 10px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                  {remoteName}
                </div>
              )}

              {remoteHandRaised && (
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: '#fff', padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: 13 }}>
                  ✋ {remoteName} raised their hand
                </div>
              )}

              {status !== 'connected' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff' }}>
                  <div style={{ width: 48, height: 48, border: '4px solid #00C853', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rfSpin 1s linear infinite' }} />
                  <p style={{ margin: 0, fontSize: 15 }}>Waiting for {isHost ? 'candidate' : 'interviewer'} to join…</p>
                  <style>{`@keyframes rfSpin{to{transform:rotate(360deg)}}`}</style>
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
                  {screenOn ? '🖥 Sharing' : myName + ' (You)'}
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
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[{ name: myName + ' (You)', active: true }, { name: remoteName, active: remoteJoined }].map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.active ? '#00C853' : '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {p.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 500 }}>{p.name}</p>
                      <p style={{ margin: 0, color: p.active ? '#00C853' : '#888', fontSize: 11 }}>{p.active ? 'In call' : 'Not joined'}</p>
                    </div>
                  </div>
                ))}
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
          <button onClick={toggleMic} style={BtnStyle(micOn)}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button onClick={toggleCam} style={BtnStyle(camOn)}>
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
            {camOn ? 'Cam Off' : 'Cam On'}
          </button>
          <button onClick={toggleScreen} style={BtnStyle(!screenOn)}>
            {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
            {screenOn ? 'Stop Share' : 'Share Screen'}
          </button>
          <button onClick={toggleHand} style={{ ...BtnStyle(!handRaised), background: handRaised ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: 16 }}>✋</span>
            {handRaised ? 'Lower Hand' : 'Raise Hand'}
          </button>
          <button onClick={() => setPanel(p => p === 'chat' ? 'none' : 'chat')} style={{ ...BtnStyle(panel === 'chat'), position: 'relative' }}>
            <MessageSquare size={18} />
            Chat
            {unread > 0 && panel !== 'chat' && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button onClick={() => setPanel(p => p === 'people' ? 'none' : 'people')} style={BtnStyle(panel === 'people')}>
            <Users size={18} />
            People
          </button>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          <button onClick={onClose} style={{ ...BtnStyle(true, true), background: '#dc2626', minWidth: 64 }}>
            <PhoneOff size={18} />
            End Call
          </button>
        </div>
      )}
    </div>
  );
}
