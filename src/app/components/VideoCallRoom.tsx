import { useEffect, useRef } from 'react';
import { X, Video } from 'lucide-react';

interface Props {
  applicationId: string;
  candidateName?: string;
  jobTitle?: string;
  onClose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export function VideoCallRoom({ applicationId, candidateName, jobTitle, onClose }: Props) {
  // Room name must not contain dashes or spaces — use alphanumeric only
  const roomName = `RecruitFriend${applicationId.replace(/-/g, '').substring(0, 16)}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;

    function initJitsi() {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        configOverwrite: {
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableInviteFunctions: true,
          enableLobbyChat: false,
          hideLobbyButton: true,
          requireDisplayName: false,
          enableWelcomePage: false,
          // Disable lobby entirely
          lobby: { enabled: false },
          securityUi: { hideLobbyButton: true, disableLobbyPassword: true },
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'hangup', 'chat',
            'fullscreen', 'settings', 'videoquality', 'tileview',
          ],
        },
        userInfo: {
          displayName: candidateName || 'Interview Participant',
        },
      });

      // Force disable lobby as soon as we join
      apiRef.current.addEventListener('videoConferenceJoined', () => {
        apiRef.current?.executeCommand('toggleLobby', false);
      });
    }

    if (window.JitsiMeetExternalAPI) {
      initJitsi();
    } else {
      script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = initJitsi;
      document.head.appendChild(script);
    }

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [roomName, candidateName]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0A2540',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
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
            {jobTitle || 'Video Interview'}
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

      {/* Jitsi container — External API mounts here */}
      <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
    </div>
  );
}
