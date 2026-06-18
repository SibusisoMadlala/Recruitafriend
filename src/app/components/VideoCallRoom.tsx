import { useEffect, useState } from 'react';
import { X, Video, Loader2 } from 'lucide-react';
import { apiCall } from '../lib/supabase';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, onClose }: Props) {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiCall(`/video-room/${applicationId}`, { requireAuth: true })
      .then(({ url }) => setRoomUrl(url))
      .catch(() => setError('Could not start video call. Please try again.'));
  }, [applicationId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0A2540', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: '#0A2540', color: 'white', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Video style={{ width: '1.25rem', height: '1.25rem', color: '#00C853' }} />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {jobTitle || 'Video Interview'}{candidateName ? ` — ${candidateName}` : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: 600 }}
        >
          <X style={{ width: '0.875rem', height: '0.875rem' }} />
          End & Close
        </button>
      </div>

      {/* Content */}
      {error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '1rem' }}>
          <p>{error}</p>
          <button onClick={onClose} style={{ background: '#00C853', border: 'none', color: 'white', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}>Close</button>
        </div>
      ) : !roomUrl ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '0.75rem' }}>
          <Loader2 style={{ width: '1.5rem', height: '1.5rem', animation: 'spin 1s linear infinite' }} />
          <span>Starting video call…</span>
        </div>
      ) : (
        <iframe
          src={roomUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="Video Interview"
        />
      )}
    </div>
  );
}
