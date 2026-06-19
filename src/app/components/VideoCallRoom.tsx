import { useEffect, useRef } from 'react';

declare global {
  interface Window { JitsiMeetExternalAPI: any; }
}

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  isHost?: boolean;
  onClose: () => void;
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, isHost = false, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef       = useRef<any>(null);

  useEffect(() => {
    let disposed = false;

    function initJitsi() {
      if (disposed || !containerRef.current || !window.JitsiMeetExternalAPI) return;

      const roomName = `rf-interview-${applicationId.replace(/-/g, '')}`;
      const displayName = isHost ? 'Interviewer' : (candidateName || 'Candidate');

      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        width:  '100%',
        height: '100%',
        userInfo: { displayName },
        configOverwrite: {
          startWithAudioMuted:    false,
          startWithVideoMuted:    false,
          disableSimulcast:       false,
          enableNoisyMicDetection: true,
          prejoinPageEnabled:     false,
          disableDeepLinking:     true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK:        false,
          SHOW_WATERMARK_FOR_GUESTS:   false,
          SHOW_BRAND_WATERMARK:        false,
          SHOW_POWERED_BY:             false,
          DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'hangup',
            'chat', 'raisehand', 'tileview',
          ],
        },
      });

      apiRef.current.addEventListener('readyToClose', () => {
        if (!disposed) onClose();
      });
    }

    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.head.appendChild(script);
      return () => {
        disposed = true;
        apiRef.current?.dispose();
        try { document.head.removeChild(script); } catch {}
      };
    }

    return () => {
      disposed = true;
      apiRef.current?.dispose();
    };
  }, [applicationId, isHost, candidateName, onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#111' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
