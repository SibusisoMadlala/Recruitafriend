import { X, Video } from 'lucide-react';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, onClose }: Props) {
  // Derive a short, unique room name from the application ID
  const roomName = `RF-${applicationId.replace(/-/g, '').substring(0, 20)}`;
  const jitsiUrl = `https://meet.jit.si/${roomName}#config.lobby.enabled=false&config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10,37,64,0.85)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: '#0A2540',
          color: 'white',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Video style={{ width: '1.25rem', height: '1.25rem', color: '#00C853' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {jobTitle ? `${jobTitle}` : 'Video Interview'}
            {candidateName ? ` — ${candidateName}` : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: 'white',
            borderRadius: '0.5rem',
            padding: '0.4rem 0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          <X style={{ width: '0.875rem', height: '0.875rem' }} />
          End & Close
        </button>
      </div>

      {/* Jitsi iframe */}
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ flex: 1, border: 'none', width: '100%' }}
        title="Video Interview"
      />
    </div>
  );
}
