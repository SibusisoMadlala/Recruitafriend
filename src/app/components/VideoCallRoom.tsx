import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  MessageSquare, Users, Maximize2, Minimize2, Send, PhoneOff,
  Wifi, WifiOff, Copy, Check, UserPlus, Loader2,
  Circle, Square, FileText, Save,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';

interface ChatMsg { from: string; text: string; ts: number; }


type PeerInfo = {
  id: string; name: string; pc: RTCPeerConnection;
  stream: MediaStream; pendingIce: RTCIceCandidateInit[];
};

type RenderPeer = {
  id: string; name: string; stream: MediaStream | null;
  connected: boolean; handRaised: boolean;
};

type TeamMember = { id: string; member_id: string; member_email: string; member_name: string | null; };

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  guestName?: string;
  onClose: () => void;
}

const MAX_PEERS = 9;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canScreenShare = !isIOS && !!navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices;

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, guestName, onClose }: Props) {
  const { profile, user } = useAuth();
  const myName = guestName || profile?.name || (isHost ? 'Interviewer' : (candidateName || 'Candidate'));

  const localRef      = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useCallback((el: HTMLVideoElement | null) => {
    localRef.current = el;
    if (el) {
      const src = screenRef.current || streamRef.current;
      if (src) { el.srcObject = src; el.play().catch(() => {}); }
    }
  }, []);
  const streamRef     = useRef<MediaStream | null>(null);
  const screenRef     = useRef<MediaStream | null>(null);
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myPeerId      = useRef(crypto.randomUUID());
  const peersRef      = useRef<Map<string, PeerInfo>>(new Map());
  const peerVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const offeredTo     = useRef(new Set<string>());
  const heardFrom     = useRef(new Set<string>());
  const hasConnected  = useRef(false);
  const earlyIceRef   = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const iceServersRef = useRef<RTCIceServer[]>([
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:standard.relay.metered.ca:80',                    username: 'b10f323ae4c187a5b438d9e8', credential: '43IcD0tWmTuKZrWR' },
    { urls: 'turn:standard.relay.metered.ca:80?transport=tcp',      username: 'b10f323ae4c187a5b438d9e8', credential: '43IcD0tWmTuKZrWR' },
    { urls: 'turn:standard.relay.metered.ca:443',                   username: 'b10f323ae4c187a5b438d9e8', credential: '43IcD0tWmTuKZrWR' },
    { urls: 'turns:standard.relay.metered.ca:443?transport=tcp',    username: 'b10f323ae4c187a5b438d9e8', credential: '43IcD0tWmTuKZrWR' },
  ]);
  const myNameRef          = useRef(myName);
  myNameRef.current        = myName;

  const [status, setStatus]             = useState<'starting'|'waiting'|'connected'|'reconnecting'|'error'>('starting');
  const [errorMsg, setErrorMsg]         = useState('');
  const [renderPeers, setRenderPeers]   = useState<RenderPeer[]>([]);
  const [micOn, setMicOn]               = useState(true);
  const [camOn, setCamOn]               = useState(true);
  const [screenOn, setScreenOn]         = useState(false);
  const [handRaised, setHandRaised]     = useState(false);
  const [panel, setPanel]               = useState<'none'|'chat'|'people'|'notes'>('none');
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [fullscreen, setFullscreen]     = useState(false);
  const [messages, setMessages]         = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [unread, setUnread]             = useState(0);
  const [quality, setQuality]           = useState<'good'|'poor'|'unknown'>('unknown');
  const [duration, setDuration]         = useState(0);
  const [copiedFor, setCopiedFor]       = useState<string|null>(null); // peerId or 'main'
  const [teamMembers, setTeamMembers]   = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded]     = useState(false);
  const [teamLoading, setTeamLoading]   = useState(false);
  const [spotlightId, setSpotlightId]   = useState<string|null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [connStatus, setConnStatus]     = useState('');
  const [audioDiag, setAudioDiag]       = useState({ localTracks: 0, remoteTracks: 0, micEnabled: true, receiving: false });
  const [recording, setRecording]       = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [videoQuality, setVideoQuality] = useState<'normal' | 'hd' | 'low'>('normal');
  const mediaRecRef                     = useRef<MediaRecorder | null>(null);
  const audioCtxRef                     = useRef<AudioContext | null>(null);
  const rafIdRef                        = useRef<number | null>(null);
  const [notes, setNotes]               = useState('');
  const [notesSaved, setNotesSaved]     = useState(false);


  const meetingLink = `${window.location.origin}/join/${applicationId}`;

  // ─── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  // ─── Quality (first peer) ────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(async () => {
      const first = Array.from(peersRef.current.values())[0];
      if (!first) return;
      try {
        const stats = await first.pc.getStats();
        let lost = 0, total = 0;
        stats.forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'video') { lost = r.packetsLost ?? 0; total = r.packetsReceived ?? 0; } });
        // Only show 'poor' once we've actually received some packets — before that it's just
        // the stream warming up (no data yet ≠ bad quality).
        setQuality(total === 0 ? 'unknown' : lost / (total + lost) < 0.05 ? 'good' : 'poor');
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [status]);

  // ─── Chat scroll / unread ────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (panel !== 'chat') setUnread(u => u + 1);
  }, [messages]);
  useEffect(() => { if (panel === 'chat') setUnread(0); }, [panel]);

  // ─── Sync streams to video elements ──────────────────────────────────────
  useEffect(() => {
    for (const peer of renderPeers) {
      if (!peer.stream || !peer.connected) continue;
      const el = peerVideoRefs.current.get(peer.id);
      if (!el) continue;
      if (el.srcObject !== peer.stream) {
        el.srcObject = peer.stream;
        el.play().catch((e: any) => {
          if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') setAudioBlocked(true);
        });
      } else if (el.paused) {
        el.play().catch((e: any) => {
          if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') setAudioBlocked(true);
        });
      }
    }
  }, [renderPeers]);

  // ─── Derive call status from peer list ───────────────────────────────────
  useEffect(() => {
    if (status === 'starting' || status === 'error') return;
    const any = renderPeers.some(p => p.connected);
    if (any) { hasConnected.current = true; setStatus('connected'); }
    else if (hasConnected.current) setStatus('reconnecting');
  }, [renderPeers]);

  // ─── Load team members when People panel opens (host only) ───────────────
  useEffect(() => {
    if (panel !== 'people' || !isHost || teamLoaded || !user) return;
    setTeamLoaded(true);
    setTeamLoading(true);
    supabase.from('team_members').select('id, member_id, member_email, member_name')
      .eq('owner_id', user.id)
      .then(({ data }) => { setTeamMembers(data ?? []); setTeamLoading(false); });
  }, [panel, isHost, teamLoaded, user]);

  // ─── Notes: load from localStorage on mount, auto-save on change ────────────
  useEffect(() => {
    const saved = localStorage.getItem(`rf-notes-${applicationId}`);
    if (saved) setNotes(saved);
  }, [applicationId]);
  useEffect(() => {
    localStorage.setItem(`rf-notes-${applicationId}`, notes);
    setNotesSaved(false);
  }, [notes, applicationId]);


  // ─── Re-announce while waiting/reconnecting (handles missed initial rfhello) ─
  useEffect(() => {
    if (status !== 'waiting' && status !== 'reconnecting') return;
    const payload = { peerId: myPeerId.current, peerName: myNameRef.current, iceServers: iceServersRef.current };
    // Fire immediately on entering this state — don't wait 5 s for the first retry
    channelRef.current?.send({ type: 'broadcast', event: 'rfhello', payload });
    const t = setInterval(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'rfhello', payload });
    }, 5000);
    return () => clearInterval(t);
  }, [status]);

  // ─── Hand re-broadcast so late joiners see it ────────────────────────────
  useEffect(() => {
    if (!handRaised) return;
    const t = setInterval(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'rfhand', payload: { from: myPeerId.current, raised: true } });
    }, 3000);
    return () => clearInterval(t);
  }, [handRaised]);

  // ─── Main signaling effect ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const myId = myPeerId.current;

    function hasTurn(servers: RTCIceServer[]) {
      return servers.some(s =>
        (Array.isArray(s.urls) ? s.urls : [s.urls]).some(u => typeof u === 'string' && /^turns?:/.test(u))
      );
    }
    function hasMeteredTurn(servers: RTCIceServer[]) {
      return servers.some(s => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return urls.some((u: unknown) => typeof u === 'string' && (u as string).includes('relay.metered.ca'));
      });
    }
    // Adopt peer's ICE servers if they have Metered TURN and we don't.
    function shouldAdopt(peerIce: RTCIceServer[]) {
      if (!hasTurn(peerIce)) return false;
      if (!hasTurn(iceServersRef.current)) return true;
      return hasMeteredTurn(peerIce) && !hasMeteredTurn(iceServersRef.current);
    }

    async function start() {
      const iceServers = iceServersRef.current;
      let stream: MediaStream;

      const mediaRes = await navigator.mediaDevices.getUserMedia({
        video: { aspectRatio: { ideal: 16 / 9 }, width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }).then(s => ({ status: 'fulfilled' as const, value: s }))
        .catch(e => ({ status: 'rejected' as const, reason: e }));

      if (mediaRes.status === 'rejected') {
        if (!alive) return;
        const err = mediaRes.reason;
        setErrorMsg(err?.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Allow access in your browser settings.'
          : 'Could not access camera or microphone. Check your device.');
        setStatus('error'); return;
      }
      stream = mediaRes.value;
      if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

      // ── Audio diagnostics: getUserMedia result ──
      const localAudio = stream.getAudioTracks();
      console.log(`[Audio] getUserMedia: audioTracks=${localAudio.length} videoTracks=${stream.getVideoTracks().length}`);
      localAudio.forEach((t, i) => console.log(`[Audio] localTrack[${i}]: enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState} id=${t.id.slice(0,8)}`));
      setAudioDiag(d => ({ ...d, localTracks: localAudio.length, micEnabled: localAudio[0]?.enabled ?? false }));

      streamRef.current = stream;
      if (localRef.current) { localRef.current.srcObject = stream; localRef.current.play().catch(() => {}); }

      const ch = supabase.channel(`rf-video-${applicationId}`, { config: { broadcast: { self: false } } });
      channelRef.current = ch;

      function initPeer(peerId: string, peerName: string): PeerInfo {
        const existing = peersRef.current.get(peerId);
        if (existing) return existing;
        const remoteStream = new MediaStream();
        const pc = new RTCPeerConnection({
          iceServers: iceServersRef.current,
          iceTransportPolicy: 'relay',
        });
        streamRef.current?.getTracks().forEach(t => {
          console.log(`[Audio] addTrack to PC: kind=${t.kind} enabled=${t.enabled} readyState=${t.readyState} peer=${peerId.slice(0,8)}`);
          pc.addTrack(t, streamRef.current!);
        });
        // If screen sharing is already active when a new peer joins, send them the screen track
        if (screenRef.current) {
          const screenTrack = screenRef.current.getVideoTracks()[0];
          if (screenTrack) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack).catch(() => {});
          }
        }
        // Only reconnect if video was flowing before — not during initial ICE negotiation
        let wasConnected = false;
        pc.ontrack = (e) => {
          wasConnected = true;
          remoteStream.addTrack(e.track);
          const snap = new MediaStream(remoteStream.getTracks());
          const snapAudio = snap.getAudioTracks().length;
          const snapVideo = snap.getVideoTracks().length;
          console.log(`[Audio] ontrack: kind=${e.track.kind} enabled=${e.track.enabled} muted=${e.track.muted} readyState=${e.track.readyState} peer=${peerId.slice(0,8)}`);
          console.log(`[Audio] remoteStream now: audio=${snapAudio} video=${snapVideo}`);
          setAudioDiag(d => ({ ...d, remoteTracks: snapAudio, receiving: snapAudio > 0 }));
          const el = peerVideoRefs.current.get(peerId);
          if (el) {
            el.muted = false;
            el.volume = 1;
            el.srcObject = snap;
            el.play().catch((err: any) => {
              console.log(`[Audio] ontrack play() error: name=${err?.name} msg=${err?.message}`);
              if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') setAudioBlocked(true);
            });
          }
          setConnStatus('');
          setRenderPeers(prev => prev.map(p => p.id === peerId ? { ...p, connected: true, stream: snap } : p));
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) ch.send({ type: 'broadcast', event: 'rfice', payload: { from: myId, to: peerId, candidate: e.candidate.toJSON() } });
        };
        pc.onconnectionstatechange = () => {
          console.log(`[WebRTC] connectionState=${pc.connectionState} peer=${peerId.slice(0,8)}`);
        };
        pc.oniceconnectionstatechange = () => {
          const s = pc.iceConnectionState;
          console.log(`[WebRTC] iceConnectionState=${s} peer=${peerId.slice(0,8)}`);
          setConnStatus(`ICE: ${s}`);
          if (s === 'connected' || s === 'completed') {
            pc.getStats().then(stats => {
              stats.forEach(r => {
                if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
                  const local = stats.get(r.localCandidateId) as any;
                  const remote = stats.get(r.remoteCandidateId) as any;
                  const isRelay = local?.candidateType === 'relay';
                  console.log(`[WebRTC] selected pair — local:${local?.candidateType}(${local?.protocol}) remote:${remote?.candidateType} relay=${isRelay}`);
                }
              });
            }).catch(() => {});
          }
          function localCleanup() {
            if (!alive) return;
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') return;
            if (peersRef.current.get(peerId)?.pc !== pc) return;
            // Tell the other side to also tear down — without this, they stay 'disconnected'
            // with a stale PC and never re-enter the reconnecting flow.
            ch.send({ type: 'broadcast', event: 'rfreset', payload: { from: myId, to: peerId } });
            pc.close();
            peersRef.current.delete(peerId);
            offeredTo.current.delete(peerId);
            heardFrom.current.delete(peerId);
            setRenderPeers(prev => prev.filter(p => p.id !== peerId));
          }
          // Always clean up on failed — including initial attempts.
          // Leaving a failed PC in peersRef causes initPeer to reuse it, preventing recovery.
          if (s === 'failed') localCleanup();
          else if (s === 'disconnected' && wasConnected) {
            setTimeout(async () => {
              if (!alive || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') return;
              if (peersRef.current.get(peerId)?.pc !== pc) return;
              // Offerer attempts ICE restart before full teardown
              if (offeredTo.current.has(peerId)) {
                try {
                  const offer = await pc.createOffer({ iceRestart: true });
                  await pc.setLocalDescription(offer);
                  ch.send({ type: 'broadcast', event: 'rfoffer', payload: { from: myId, to: peerId, sdp: offer, peerName: myNameRef.current, iceServers: iceServersRef.current } });
                  // Give restart 8 s to succeed before falling through to full cleanup
                  setTimeout(localCleanup, 8000);
                  return;
                } catch {}
              }
              localCleanup();
            }, 3000);
          }
        };
        const earlyIce = earlyIceRef.current.get(peerId) ?? [];
        earlyIceRef.current.delete(peerId);
        const info: PeerInfo = { id: peerId, name: peerName, pc, stream: remoteStream, pendingIce: earlyIce };
        peersRef.current.set(peerId, info);
        setRenderPeers(prev => [...prev.filter(p => p.id !== peerId), { id: peerId, name: peerName, stream: null, connected: false, handRaised: false }]);
        return info;
      }

      async function offerTo(peerId: string, peerName: string) {
        if (offeredTo.current.has(peerId)) {
          // Re-offer if the previous offer's PC is gone or unhealthy
          const existing = peersRef.current.get(peerId);
          const pcOk = existing && (
            existing.pc.iceConnectionState === 'connected' ||
            existing.pc.iceConnectionState === 'completed' ||
            existing.pc.iceConnectionState === 'checking' ||
            existing.pc.iceConnectionState === 'new'
          );
          if (pcOk) return;
          if (existing) { existing.pc.close(); peersRef.current.delete(peerId); }
          offeredTo.current.delete(peerId);
          heardFrom.current.delete(peerId);
          setRenderPeers(prev => prev.filter(p => p.id !== peerId));
        }
        if (peersRef.current.size >= MAX_PEERS) { toast.error('This call is full (max 10 people).'); return; }
        offeredTo.current.add(peerId);
        const info = initPeer(peerId, peerName);
        try {
          const offer = await info.pc.createOffer();
          await info.pc.setLocalDescription(offer);
          ch.send({ type: 'broadcast', event: 'rfoffer', payload: { from: myId, to: peerId, sdp: offer, peerName: myNameRef.current, iceServers: iceServersRef.current } });
        } catch {}
      }

      ch.on('broadcast', { event: 'rfhello' }, async ({ payload }) => {
        if (!alive) return;
        const { peerId, peerName, iceServers: peerIce } = payload as { peerId: string; peerName: string; iceServers?: RTCIceServer[] };
        if (peerId === myId) return;
        if (peerIce?.length && shouldAdopt(peerIce)) iceServersRef.current = [...peerIce, ...iceServersRef.current];
        // If we have a broken connection to this peer, tear it down so we re-offer fresh.
        // This handles the case where the other side cleaned up locally and re-announced.
        const existingInfo = peersRef.current.get(peerId);
        const connBroken = existingInfo && (
          existingInfo.pc.iceConnectionState === 'failed' ||
          existingInfo.pc.connectionState === 'failed' ||
          existingInfo.pc.connectionState === 'closed'
        );
        if (connBroken) {
          existingInfo!.pc.close();
          peersRef.current.delete(peerId);
          offeredTo.current.delete(peerId);
          heardFrom.current.delete(peerId);
          setRenderPeers(prev => prev.filter(p => p.id !== peerId));
        }
        if (!heardFrom.current.has(peerId)) {
          heardFrom.current.add(peerId);
          setConnStatus(`Found ${peerName} — connecting…`);
          ch.send({ type: 'broadcast', event: 'rfhello', payload: { peerId: myId, peerName: myNameRef.current, iceServers: iceServersRef.current } });
        }
        if (myId > peerId) await offerTo(peerId, peerName);
      });

      ch.on('broadcast', { event: 'rfoffer' }, async ({ payload }) => {
        if (!alive) return;
        const { from, to, sdp, peerName, iceServers: peerIce } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit; peerName?: string; iceServers?: RTCIceServer[] };
        if (to !== myId) return;
        if (peersRef.current.size >= MAX_PEERS && !peersRef.current.has(from)) { toast.error('Call is full.'); return; }
        // Adopt TURN from offerer if they have it and we don't
        if (peerIce?.length && shouldAdopt(peerIce)) iceServersRef.current = [...peerIce, ...iceServersRef.current];
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

      ch.on('broadcast', { event: 'rfanswer' }, async ({ payload }) => {
        if (!alive) return;
        const { from, to, sdp, peerName } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit; peerName?: string };
        if (to !== myId) return;
        if (peerName) setRenderPeers(prev => prev.map(p => p.id === from ? { ...p, name: peerName } : p));
        const info = peersRef.current.get(from);
        if (!info) return;
        try {
          await info.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const c of info.pendingIce) { try { await info.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
          info.pendingIce = [];
        } catch {}
      });

      ch.on('broadcast', { event: 'rfice' }, async ({ payload }) => {
        if (!alive) return;
        const { from, to, candidate } = payload as { from: string; to: string; candidate: RTCIceCandidateInit };
        if (to !== myId) return;
        const info = peersRef.current.get(from);
        if (!info) {
          // Peer not initialised yet — buffer until initPeer is called
          if (!earlyIceRef.current.has(from)) earlyIceRef.current.set(from, []);
          earlyIceRef.current.get(from)!.push(candidate);
          return;
        }
        if (info.pc.remoteDescription) { try { await info.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {} }
        else info.pendingIce.push(candidate);
      });

      ch.on('broadcast', { event: 'rfleave' }, ({ payload }) => {
        if (!alive) return;
        const { peerId } = payload as { peerId: string };
        const info = peersRef.current.get(peerId);
        if (info) { info.pc.close(); peersRef.current.delete(peerId); }
        offeredTo.current.delete(peerId); heardFrom.current.delete(peerId);
        setRenderPeers(prev => prev.filter(p => p.id !== peerId));
      });

      // rfreset: the other side has given up on our shared connection and torn down
      // their PC. We do the same so both sides re-enter the reconnecting flow together,
      // after which rfhello retries re-establish the call without anyone pressing anything.
      ch.on('broadcast', { event: 'rfreset' }, ({ payload }) => {
        if (!alive) return;
        const { from, to } = payload as { from: string; to: string };
        if (to !== myId) return;
        const info = peersRef.current.get(from);
        if (info) { info.pc.close(); peersRef.current.delete(from); }
        offeredTo.current.delete(from);
        heardFrom.current.delete(from);
        setRenderPeers(prev => prev.filter(p => p.id !== from));
      });

      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!alive) return;
        for (const p of leftPresences as any[]) {
          const peerId = p?.peerId;
          if (!peerId) continue;
          const info = peersRef.current.get(peerId);
          if (info) { info.pc.close(); peersRef.current.delete(peerId); }
          offeredTo.current.delete(peerId); heardFrom.current.delete(peerId);
          setRenderPeers(prev => prev.filter(r => r.id !== peerId));
        }
      });

      ch.on('broadcast', { event: 'rfchat' }, ({ payload }) => {
        if (!alive) return;
        const msg = payload as ChatMsg;
        setMessages(m => [...m, msg]);
        if (panelRef.current !== 'chat') {
          const preview = msg.text.length > 60 ? msg.text.slice(0, 60) + '…' : msg.text;
          toast(`💬 ${msg.from}: ${preview}`, {
            action: { label: 'Open', onClick: () => setPanel('chat') },
            duration: 4000,
          });
        }
      });

      ch.on('broadcast', { event: 'rfhand' }, ({ payload }) => {
        if (!alive) return;
        const { from, raised } = payload as { from: string; raised: boolean };
        setRenderPeers(prev => prev.map(p => p.id === from ? { ...p, handRaised: raised } : p));
      });


      ch.subscribe((s) => {
        if (s !== 'SUBSCRIBED' || !alive) return;
        ch.track({ peerId: myId, name: myNameRef.current }).catch(() => {});
        // Only set 'waiting' on the very first subscription — not on channel reconnects
        if (!hasConnected.current && peersRef.current.size === 0) setStatus('waiting');
        ch.send({ type: 'broadcast', event: 'rfhello', payload: { peerId: myId, peerName: myNameRef.current, iceServers: iceServersRef.current } });
      });

    }

    start();

    // When device switches networks (WiFi → mobile data), re-announce multiple times.
    // The Supabase channel may take a few seconds to reconnect after a network change,
    // so we retry every 2 s for 10 s to ensure the message gets through.
    const handleOnline = () => {
      if (!alive) return;
      let count = 0;
      const announce = () => {
        if (!alive || count >= 6) return;
        channelRef.current?.send({
          type: 'broadcast', event: 'rfhello',
          payload: { peerId: myPeerId.current, peerName: myNameRef.current, iceServers: iceServersRef.current },
        });
        count++;
        setTimeout(announce, 2000);
      };
      setTimeout(announce, 500); // small head start so channel can reconnect first
    };
    window.addEventListener('online', handleOnline);

    return () => {
      alive = false;
      window.removeEventListener('online', handleOnline);
      channelRef.current?.send({ type: 'broadcast', event: 'rfleave', payload: { peerId: myPeerId.current } });
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(info => info.pc.close());
      peersRef.current.clear();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [applicationId]);

  // ─── Controls ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      console.log(`[Audio] toggleMic: enabled=${t.enabled} readyState=${t.readyState}`);
      setMicOn(t.enabled);
      setAudioDiag(d => ({ ...d, micEnabled: t.enabled }));
    }
  }, []);

  const toggleCam = useCallback(() => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); }
  }, []);

  const cycleQuality = useCallback(async () => {
    const next = videoQuality === 'normal' ? 'hd' : videoQuality === 'hd' ? 'low' : 'normal';

    const camConstraints = {
      hd:     { aspectRatio: { ideal: 16/9 }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      normal: { aspectRatio: { ideal: 16/9 }, width: { ideal: 854  }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
      low:    { aspectRatio: { ideal: 16/9 }, width: { ideal: 640  }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
    };
    const encParams = {
      hd:     { maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
      normal: { maxBitrate: 800_000,   maxFramerate: 24, scaleResolutionDownBy: 1 },
      low:    { maxBitrate: 350_000,   maxFramerate: 15, scaleResolutionDownBy: 2 },
    };

    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try { await track.applyConstraints(camConstraints[next]); } catch {}
    }

    peersRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (!sender) return;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      const p = encParams[next];
      params.encodings.forEach(enc => {
        enc.maxBitrate            = p.maxBitrate;
        enc.maxFramerate          = p.maxFramerate;
        enc.scaleResolutionDownBy = p.scaleResolutionDownBy;
      });
      sender.setParameters(params).catch(() => {});
    });

    setVideoQuality(next);
    const labels = { hd: 'HD — 720p (needs good WiFi)', normal: 'Normal quality', low: 'Low Data — saves mobile data' };
    toast.success(labels[next]);
  }, [videoQuality]);

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
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: { frameRate: 30 }, audio: false });
        screenRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        peersRef.current.forEach(async ({ pc }) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(screenTrack);
        });
        if (localRef.current) localRef.current.srcObject = screen;
        // Inline cleanup to avoid stale closure on toggleScreen
        screenTrack.onended = () => {
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
        };
        setScreenOn(true);
      } catch (err: any) {
        if (err?.name !== 'NotAllowedError') {
          toast.error('Screen sharing failed: ' + (err?.message || 'not supported on this browser/device'));
        }
      }
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

  function startRecording() {
    if (peersRef.current.size === 0) { toast.error('No one else is in the call yet.'); return; }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const drawCtx = canvas.getContext('2d')!;

      function getGrid(n: number): { cols: number; rows: number } {
        if (n <= 1) return { cols: 1, rows: 1 };
        if (n <= 2) return { cols: 2, rows: 1 };
        if (n <= 4) return { cols: 2, rows: 2 };
        if (n <= 6) return { cols: 3, rows: 2 };
        if (n <= 9) return { cols: 3, rows: 3 };
        return { cols: 4, rows: 3 };
      }

      function drawFrame() {
        const currentPeers = Array.from(peersRef.current.values());
        const tiles = [
          { el: localRef.current, name: myNameRef.current + ' (You)', isLocal: true },
          ...currentPeers.map(p => ({ el: peerVideoRefs.current.get(p.id) ?? null, name: p.name, isLocal: false })),
        ];
        const { cols, rows } = getGrid(tiles.length);
        const cellW = 1280 / cols;
        const cellH = 720 / rows;

        drawCtx.fillStyle = '#111';
        drawCtx.fillRect(0, 0, 1280, 720);

        tiles.forEach((tile, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * cellW;
          const y = row * cellH;

          if (tile.el && tile.el.readyState >= 2) {
            if (tile.isLocal) {
              drawCtx.save();
              drawCtx.translate(x + cellW, y);
              drawCtx.scale(-1, 1);
              drawCtx.drawImage(tile.el, 0, 0, cellW, cellH);
              drawCtx.restore();
            } else {
              drawCtx.drawImage(tile.el, x, y, cellW, cellH);
            }
          } else {
            drawCtx.fillStyle = '#222';
            drawCtx.fillRect(x, y, cellW, cellH);
          }

          // Name label
          const fontSize = Math.max(11, Math.min(14, cellW / 15));
          drawCtx.fillStyle = 'rgba(0,0,0,0.55)';
          drawCtx.fillRect(x, y + cellH - 28, Math.min(180, cellW), 28);
          drawCtx.fillStyle = '#fff';
          drawCtx.font = `bold ${fontSize}px sans-serif`;
          drawCtx.fillText(tile.name, x + 8, y + cellH - 9);
        });

        rafIdRef.current = requestAnimationFrame(drawFrame);
      }
      drawFrame();

      // ── Mixed audio from all participants ──
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      streamRef.current?.getAudioTracks().forEach(t =>
        audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest)
      );
      Array.from(peersRef.current.values()).forEach(peer => {
        peer.stream.getAudioTracks().forEach(t =>
          audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest)
        );
      });

      const canvasStream = canvas.captureStream(25);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : '';
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const rec = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
        audioCtx.close();
        audioCtxRef.current = null;
        const blob = new Blob(chunks, { type: mimeType || `video/${ext}` });
        void uploadRecording(blob, ext);
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
      toast.success('Recording started');
    } catch (err: any) {
      toast.error('Could not start recording: ' + (err?.message ?? err));
    }
  }

  function stopRecording() {
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
    setRecording(false);
  }

  async function uploadRecording(blob: Blob, ext = 'webm') {
    setUploading(true);
    const ts = Date.now();
    const filePath = `${applicationId}/${ts}.${ext}`;
    const contentType = ext === 'mp4' ? 'video/mp4' : 'video/webm';
    try {
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .upload(filePath, blob, { contentType, upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('call-recordings').getPublicUrl(data.path);
      await supabase.from('call_recordings').insert({
        application_id: applicationId,
        employer_id: user?.id || null,
        job_title: jobTitle || null,
        candidate_name: candidateName || null,
        storage_path: data.path,
        video_url: urlData.publicUrl,
        recorded_at: new Date().toISOString(),
      });
      toast.success('Recording saved to your dashboard!');
    } catch {
      // Fallback: offer download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview-${applicationId}-${ts}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Recording downloaded (could not save to dashboard)');
    } finally {
      setUploading(false);
    }
  }

  async function saveNotes() {
    localStorage.setItem(`rf-notes-${applicationId}`, notes);
    try {
      await supabase.from('interview_notes').upsert(
        { application_id: applicationId, content: notes, updated_at: new Date().toISOString() },
        { onConflict: 'application_id' }
      );
    } catch {}
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2500);
  }

  function copyInvite(label: string, key: string) {
    navigator.clipboard.writeText(meetingLink).then(() => {
      setCopiedFor(key);
      toast.success(`Invite link copied! Send it to ${label}.`);
      setTimeout(() => setCopiedFor(null), 2500);
    }).catch(() => toast.error('Could not copy link'));
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const Btn = (active: boolean, danger = false): React.CSSProperties => ({
    padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: danger ? '#dc2626' : active ? 'rgba(255,255,255,0.15)' : '#dc2626',
    color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, fontSize: 11, fontWeight: 500, minWidth: 56,
  });

  function peerVideoRef(el: HTMLVideoElement | null, peerId: string, stream: MediaStream | null) {
    if (el) {
      peerVideoRefs.current.set(peerId, el);
      // Always enforce unmuted + full volume — mobile browsers can silently mute elements
      el.muted = false;
      el.volume = 1;
      if (stream) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
          el.play().catch((e: any) => {
            console.log(`[Audio] peerVideoRef play() error: ${e?.name}`);
            if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') setAudioBlocked(true);
          });
        } else if (el.paused) {
          el.play().catch((e: any) => {
            if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') setAudioBlocked(true);
          });
        }
      }
    } else {
      peerVideoRefs.current.delete(peerId);
    }
  }

  const connectedPeers = renderPeers.filter(p => p.connected);
  const anyHandRaised  = renderPeers.filter(p => p.handRaised);
  const totalTiles     = connectedPeers.length + 1;

  // Sync local video stream whenever the video element remounts (layout change)
  useEffect(() => {
    if (localRef.current) {
      const src = screenRef.current || streamRef.current;
      if (src && localRef.current.srcObject !== src) {
        localRef.current.srcObject = src;
        localRef.current.play().catch(() => {});
      }
    }
  });

  // All tiles: remote peers + local self tile
  const allTiles = [
    ...connectedPeers.map(p => ({ ...p, isLocal: false as const })),
    { id: 'local', name: myName, stream: null as MediaStream | null, connected: true, handRaised: false, isLocal: true as const },
  ];

  // If spotlighted peer left, clear spotlight
  const validSpotlight = spotlightId && (spotlightId === 'local' || connectedPeers.some(p => p.id === spotlightId)) ? spotlightId : null;

  function handleTileClick(id: string) {
    setSpotlightId(prev => prev === id ? null : id);
    if (audioBlocked) {
      peerVideoRefs.current.forEach(el => { el.muted = false; el.volume = 1; el.play().catch(() => {}); });
      setAudioBlocked(false);
    }
  }

  function unlockAudio() {
    peerVideoRefs.current.forEach(el => { el.muted = false; el.volume = 1; el.play().catch(() => {}); });
    setAudioBlocked(false);
  }


  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0d1117', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>


      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0A2540', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Video size={15} color="#00C853" style={{ flexShrink: 0 }} />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {jobTitle || 'Interview'}
          </span>
          {status === 'connected' && (
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, flexShrink: 0 }}>{fmt(duration)}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {status === 'connected' && (quality === 'good' ? <Wifi size={14} color="#00C853" /> : quality === 'poor' ? <WifiOff size={14} color="#f59e0b" /> : null)}
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', background: status === 'connected' ? '#00C853' : status === 'error' ? '#dc2626' : '#f59e0b' }}>
            {status === 'starting' ? 'Starting…'
              : status === 'waiting' ? 'Waiting…'
              : status === 'connected' ? `Live · ${connectedPeers.length + 1}`
              : status === 'reconnecting' ? 'Reconnecting…'
              : 'Error'}
          </span>
          <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }}>
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <X size={13} /> Leave
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
          {status === 'error' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
              <VideoOff size={48} color="#dc2626" />
              <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', maxWidth: 360, margin: 0 }}>{errorMsg}</p>
              <button onClick={onClose} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}>Close</button>
            </div>

          ) : connectedPeers.length === 0 ? (
            // Waiting screen
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#fff' }}>
              <div style={{ width: 48, height: 48, border: '4px solid #00C853', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rfSpin 1s linear infinite' }} />
              <p style={{ margin: 0, fontSize: 15 }}>
                {status === 'reconnecting' ? 'Reconnecting…' : `Waiting for ${isHost ? 'others to join' : 'the interviewer'}…`}
              </p>
              {connStatus && (
                <p style={{ margin: 0, fontSize: 12, color: connStatus.startsWith('ICE: fail') || connStatus.startsWith('ICE: disc') ? '#f59e0b' : '#00C853', opacity: 0.9 }}>
                  {connStatus}
                </p>
              )}
              <style>{`@keyframes rfSpin{to{transform:rotate(360deg)}}`}</style>
              {/* Local PIP while waiting */}
              <div style={{ position: 'absolute', bottom: 80, right: 16, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', background: '#222' }}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 120, height: 160, objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 6, color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.55)', padding: '1px 6px', borderRadius: 4 }}>{myName} (You)</div>
              </div>
            </div>

          ) : validSpotlight ? (() => {
            // Spotlight mode: spotlighted tile fills the area, others in a strip at bottom
            const spotTile = allTiles.find(t => t.id === validSpotlight)!;
            const otherTiles = allTiles.filter(t => t.id !== validSpotlight);
            return (
              <>
                {/* Spotlighted tile */}
                <div style={{ position: 'absolute', inset: 0, bottom: otherTiles.length > 0 ? 100 : 0, background: '#111', cursor: 'pointer' }} onClick={() => setSpotlightId(null)}>
                  {spotTile.isLocal ? (
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                  ) : (
                    <video ref={el => peerVideoRef(el, spotTile.id, spotTile.stream)} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ position: 'absolute', bottom: 12, left: 12, color: '#fff', fontSize: 14, fontWeight: 600, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 8 }}>
                    {spotTile.name}{spotTile.isLocal ? ' (You)' : ''}{spotTile.handRaised ? ' ✋' : ''}
                  </div>
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, padding: '4px 10px', borderRadius: 20 }}>Tap to exit</div>
                </div>
                {/* Thumbnail strip */}
                {otherTiles.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, display: 'flex', gap: 4, padding: '4px 4px', overflowX: 'auto', background: 'rgba(0,0,0,0.7)' }}>
                    {otherTiles.map(t => (
                      <div key={t.id} onClick={() => handleTileClick(t.id)} style={{ position: 'relative', flexShrink: 0, width: 72, height: 92, borderRadius: 8, overflow: 'hidden', background: '#222', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.2)' }}>
                        {t.isLocal ? (
                          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                        ) : (
                          <video ref={el => peerVideoRef(el, t.id, t.stream)} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                        <div style={{ position: 'absolute', bottom: 2, left: 4, color: '#fff', fontSize: 9, background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60, textOverflow: 'ellipsis' }}>{t.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })() : totalTiles === 2 ? (
            // 2 people: fullscreen remote + corner PIP for self
            <>
              <div style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} onClick={() => handleTileClick(connectedPeers[0].id)}>
                <video ref={el => peerVideoRef(el, connectedPeers[0].id, connectedPeers[0].stream)} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 90, left: 16, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 8 }}>
                  {connectedPeers[0].name}{connectedPeers[0].handRaised ? ' ✋' : ''}
                </div>
              </div>
              {/* Self PIP */}
              <div onClick={() => handleTileClick('local')} style={{ position: 'absolute', bottom: 80, right: 16, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', background: '#222', cursor: 'pointer' }}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 100, height: 140, objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 6, color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.55)', padding: '1px 6px', borderRadius: 4 }}>{screenOn ? '🖥' : 'You'}</div>
              </div>
            </>
          ) : (
            // 3-4 people: 2-column block grid, WhatsApp style
            <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: '1fr', gap: 3, padding: 3, boxSizing: 'border-box' }}>
              {allTiles.map((tile, i) => (
                <div
                  key={tile.id}
                  onClick={() => handleTileClick(tile.id)}
                  style={{
                    position: 'relative', background: '#222', borderRadius: 10, overflow: 'hidden', minHeight: 0, cursor: 'pointer',
                    // Last tile in odd count: span both columns to center it
                    gridColumn: allTiles.length % 2 !== 0 && i === allTiles.length - 1 ? '1 / -1' : undefined,
                  }}
                >
                  {tile.isLocal ? (
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
                  ) : (
                    <video ref={el => peerVideoRef(el, tile.id, tile.stream)} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 12, fontWeight: 600, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 6 }}>
                    {tile.name}{tile.isLocal ? ' (You)' : ''}{tile.handRaised ? ' ✋' : ''}
                  </div>
                  {tile.isLocal && !micOn && <div style={{ position: 'absolute', top: 8, right: 8, background: '#dc2626', borderRadius: '50%', padding: 4 }}><MicOff size={12} color="#fff" /></div>}
                  <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>⤢ tap</div>
                </div>
              ))}
            </div>
          )}


          {/* ── Recording badge ── */}
          {recording && (
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,0.92)', color: '#fff', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'rfBlink 1s ease-in-out infinite alternate' }} />
              Recording in progress
              <style>{`@keyframes rfBlink{0%{opacity:1}100%{opacity:0.2}}`}</style>
            </div>
          )}

          {/* ── Tap-to-enable-audio banner (mobile autoplay block) ── */}
          {audioBlocked && (
            <div
              onClick={unlockAudio}
              style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,200,83,0.95)', color: '#fff', padding: '12px 24px',
                borderRadius: 24, cursor: 'pointer', fontSize: 15, fontWeight: 700,
                zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
              }}
            >
              🔊 Tap to enable audio
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        {panel !== 'none' && (
          <div style={{ width: 280, background: '#1a1f2e', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                {panel === 'chat' ? 'Chat' : panel === 'notes' ? 'Meeting Notes' : 'Participants'}
              </span>
              <button onClick={() => setPanel('none')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            {/* People panel */}
            {panel === 'people' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* Invite / Share section — always at top, host only */}
                {isHost && (
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ margin: '0 0 10px', color: '#00C853', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Invite to this call
                    </p>

                    {/* Copy link */}
                    <button
                      onClick={() => copyInvite('your invitee', 'main')}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#00C853', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                      {copiedFor === 'main' ? <Check size={15} /> : <Copy size={15} />}
                      {copiedFor === 'main' ? 'Link Copied!' : 'Copy Meeting Link'}
                    </button>

                    {/* Team members */}
                    {teamLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                        <Loader2 size={16} color="#00C853" style={{ animation: 'rfSpin 1s linear infinite' }} />
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
                        No team members yet.{' '}
                        <span style={{ color: '#00C853' }}>Add them in My Team.</span>
                      </p>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your Team</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {teamMembers.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0A2540', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                {(m.member_name || m.member_email)[0].toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, color: '#fff', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.member_name || m.member_email}
                                </p>
                              </div>
                              <button
                                onClick={() => copyInvite(m.member_name || m.member_email, m.id)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, background: copiedFor === m.id ? 'rgba(0,200,83,0.15)' : 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.3)', color: '#00C853', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                {copiedFor === m.id ? <Check size={11} /> : <UserPlus size={11} />}
                                {copiedFor === m.id ? 'Copied' : 'Invite'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Current participants */}
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 10px', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>In this call</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#00C853', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {myName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 500 }}>{myName} (You)</p>
                        <p style={{ margin: 0, color: '#00C853', fontSize: 11 }}>In call</p>
                      </div>
                    </div>
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
                </div>
              </div>
            )}

            {/* Notes panel (host only) */}
            {panel === 'notes' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  Notes are auto-saved locally and can be saved to your account.
                </p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Type your interview notes here…"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, resize: 'none',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={saveNotes}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: notesSaved ? 'rgba(0,200,83,0.2)' : '#00C853', border: notesSaved ? '1px solid #00C853' : 'none', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >
                  {notesSaved ? <Check size={15} /> : <Save size={15} />}
                  {notesSaved ? 'Saved!' : 'Save Notes'}
                </button>
              </div>
            )}


            {/* Chat panel */}
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

      {/* ── Controls ── */}
      {status !== 'error' && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '10px 12px', background: '#0A2540', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={toggleMic} style={Btn(micOn)}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button onClick={toggleCam} style={Btn(camOn)}>
            {camOn ? <Video size={18} /> : <VideoOff size={18} />}
            {camOn ? 'Cam Off' : 'Cam On'}
          </button>
          <button
            onClick={() => void cycleQuality()}
            style={{
              ...Btn(true),
              background: videoQuality === 'hd' ? '#0d7537' : videoQuality === 'low' ? '#92400e' : 'rgba(255,255,255,0.15)',
              border: videoQuality === 'hd' ? '2px solid #4ade80' : videoQuality === 'low' ? '2px solid #fbbf24' : '2px solid transparent',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: videoQuality === 'hd' ? '#4ade80' : videoQuality === 'low' ? '#fbbf24' : '#fff' }}>
              {videoQuality === 'hd' ? 'HD' : videoQuality === 'low' ? 'LO' : 'SD'}
            </span>
            {videoQuality === 'hd' ? '720p' : videoQuality === 'low' ? 'Low Data' : 'Quality'}
          </button>
          {canScreenShare ? (
            <button onClick={toggleScreen} style={Btn(!screenOn)}>
              {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
              {screenOn ? 'Stop Share' : 'Share'}
            </button>
          ) : (
            <button
              disabled
              title="Screen sharing is not supported on this device"
              style={{ ...Btn(false), opacity: 0.35, cursor: 'not-allowed' }}
            >
              <Monitor size={18} />
              Share
            </button>
          )}
          <button onClick={toggleHand} style={{ ...Btn(!handRaised), background: handRaised ? '#f59e0b' : 'rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: 16 }}>✋</span>
            {handRaised ? 'Lower' : 'Hand'}
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
            {isHost ? 'Invite' : 'People'}
            {renderPeers.length > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: '#00C853', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {renderPeers.length + 1}
              </span>
            )}
          </button>
          {isHost && (
            <button onClick={() => setPanel(p => p === 'notes' ? 'none' : 'notes')} style={Btn(panel === 'notes')}>
              <FileText size={18} />
              Notes
            </button>
          )}
          {isHost && (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={uploading}
              style={{ ...Btn(true), background: uploading ? 'rgba(255,255,255,0.1)' : recording ? '#dc2626' : 'rgba(255,255,255,0.15)', position: 'relative', opacity: uploading ? 0.7 : 1 }}
            >
              {uploading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : recording ? <Square size={18} fill="#fff" /> : <Circle size={18} color="#dc2626" fill="#dc2626" />}
              {uploading ? 'Saving…' : recording ? 'Stop Rec' : 'Record'}
              {recording && !uploading && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'rfSpin 1s linear infinite' }} />
              )}
            </button>
          )}
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
          <button onClick={onClose} style={{ ...Btn(true, true), background: '#dc2626', minWidth: 60 }}>
            <PhoneOff size={18} />
            End
          </button>
        </div>
      )}
    </div>
  );
}
