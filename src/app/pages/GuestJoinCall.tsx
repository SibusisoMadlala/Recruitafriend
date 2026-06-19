import { useState } from 'react';
import { useParams } from 'react-router';
import { Video, User } from 'lucide-react';
import { VideoCallRoom } from '../components/VideoCallRoom';

export default function GuestJoinCall() {
  const { callId } = useParams<{ callId: string }>();
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);

  if (!callId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#64748b' }}>Invalid meeting link.</p>
      </div>
    );
  }

  if (joined) {
    return (
      <VideoCallRoom
        applicationId={callId}
        jobTitle="Interview Call"
        isHost={false}
        guestName={name}
        onClose={() => setJoined(false)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A2540', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>Recruit</span>
        <span style={{ fontSize: 28, fontWeight: 800, color: '#00C853' }}>Friend</span>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>Video Interview</p>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 36, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, background: 'rgba(0,200,83,0.1)', borderRadius: '50%', margin: '0 auto 20px' }}>
          <Video size={24} color="#00C853" />
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0A2540', textAlign: 'center', margin: '0 0 8px' }}>
          You're invited to join an interview
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', margin: '0 0 28px' }}>
          No account needed — just enter your name to join.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Your name
          </label>
          <div style={{ position: 'relative' }}>
            <User size={16} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && setJoined(true)}
              placeholder="e.g. John Smith"
              autoFocus
              style={{ width: '100%', paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11, border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              onFocus={e => (e.target.style.borderColor = '#00C853')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>
        </div>

        <button
          onClick={() => name.trim() && setJoined(true)}
          disabled={!name.trim()}
          style={{ width: '100%', padding: '13px 0', background: name.trim() ? '#00C853' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}>
          Join Call
        </button>

        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          By joining you agree to RecruitFriend's{' '}
          <a href="/terms" style={{ color: '#00C853', textDecoration: 'none' }}>Terms of Service</a>
        </p>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 24 }}>
        Already have an account?{' '}
        <a href="/login" style={{ color: '#00C853', textDecoration: 'none' }}>Sign in</a>
      </p>
    </div>
  );
}
