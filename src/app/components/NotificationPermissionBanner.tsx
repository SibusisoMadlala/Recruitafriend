import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pushNotifications';

interface Props {
  userId: string;
}

export function NotificationPermissionBanner({ userId }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
    const saved = localStorage.getItem('rf-notif-dismissed');
    if (saved) setDismissed(true);
  }, []);

  if (!isPushSupported() || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  async function enable() {
    setLoading(true);
    const ok = await subscribeToPush(userId);
    setPermission(ok ? 'granted' : Notification.permission as NotificationPermission);
    setLoading(false);
  }

  function dismiss() {
    localStorage.setItem('rf-notif-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'linear-gradient(135deg, #0A2540 0%, #1a3a5c 100%)',
      color: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 16,
      boxShadow: '0 2px 12px rgba(10,37,64,0.2)',
    }}>
      <Bell size={20} color="#00C853" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Get notified about interviews</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          Allow notifications to get instant alerts when an employer schedules an interview with you — even when the app is closed.
        </p>
      </div>
      <button
        onClick={enable}
        disabled={loading}
        style={{
          flexShrink: 0, padding: '8px 16px', background: '#00C853', color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Enabling…' : 'Enable notifications'}
      </button>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}

// Settings toggle — use in profile/settings pages
export function NotificationToggle({ userId }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPermission(getNotificationPermission()); }, []);

  if (!isPushSupported()) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 14 }}>
        <BellOff size={16} /> Push notifications not supported in this browser
      </div>
    );
  }

  async function toggle() {
    setLoading(true);
    if (permission === 'granted') {
      await unsubscribeFromPush(userId);
      setPermission('default');
    } else {
      const ok = await subscribeToPush(userId);
      setPermission(ok ? 'granted' : Notification.permission as NotificationPermission);
    }
    setLoading(false);
  }

  const granted = permission === 'granted';

  return (
    <button
      onClick={toggle}
      disabled={loading || permission === 'denied'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: granted ? '#00C853' : '#e5e7eb',
        color: granted ? '#fff' : '#374151',
        border: 'none', borderRadius: 8, padding: '8px 14px',
        cursor: permission === 'denied' ? 'not-allowed' : 'pointer',
        fontWeight: 500, fontSize: 14, opacity: loading ? 0.7 : 1,
      }}
    >
      {granted ? <Bell size={15} /> : <BellOff size={15} />}
      {permission === 'denied'
        ? 'Notifications blocked (enable in browser settings)'
        : granted
          ? 'Notifications on'
          : loading ? 'Setting up…' : 'Enable notifications'}
    </button>
  );
}
