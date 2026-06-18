import { X, Video } from 'lucide-react';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, onClose }: Props) {
  const roomName = `RecruitFriend${applicationId.replace(/-/g, '').substring(0, 16)}`;
  const url = `https://framatalk.org/${roomName}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.requireDisplayName=false`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0A2540', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#0A2540', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <Video size={18} color="#00C853" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {jobTitle ? `${jobTitle}` : 'Video Interview'}
            {candidateName ? ` — ${candidateName}` : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          <X size={14} />
          End & Close
        </button>
      </div>
      <iframe
        src={url}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ flex: 1, border: 'none', width: '100%' }}
        title="Video Interview"
      />
    </div>
  );
}
