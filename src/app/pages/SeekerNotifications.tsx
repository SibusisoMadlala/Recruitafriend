import { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import {
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPermission,
  isPushSupported,
  isSubscribed,
} from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';

type NotifRecord = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
};

export default function SeekerNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<string>(() => getNotificationPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inbox, setInbox] = useState<NotifRecord[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  useEffect(() => {
    setPermission(getNotificationPermission());
    isSubscribed().then(setSubscribed);
  }, []);

  useEffect(() => {
    if (!user) return;
    setInboxLoading(true);
    supabase
      .from('notifications')
      .select('id,title,body,url,read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setInbox(data ?? []);
        setInboxLoading(false);
        // Mark all as read
        supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false).then(() => {});
      });
  }, [user]);

  async function handleEnable() {
    if (!user) return;
    setLoading(true);
    const ok = await subscribeToPush(user.id);
    setPermission(getNotificationPermission());
    setSubscribed(ok);
    setLoading(false);
  }

  async function handleDisable() {
    if (!user) return;
    setLoading(true);
    await unsubscribeFromPush(user.id);
    setSubscribed(false);
    setLoading(false);
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }

  const supported = isPushSupported();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--rf-navy)]">Notifications</h1>
        <p className="text-gray-500 mt-1">Manage alerts and view your notification history.</p>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${subscribed ? 'bg-green-50' : 'bg-gray-100'}`}>
            {subscribed
              ? <Bell className="w-6 h-6 text-[var(--rf-green)]" />
              : <BellOff className="w-6 h-6 text-gray-400" />}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-[var(--rf-navy)] text-base">Push notifications</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Receive alerts on this device when an employer schedules or starts an interview with you.
            </p>
            <div className="mt-4">
              {!supported && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-[var(--rf-radius-md)] px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Push notifications are not supported in this browser.
                </div>
              )}
              {supported && permission === 'denied' && !subscribed && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-[var(--rf-radius-md)] px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Notifications are blocked. Go to your browser settings and allow notifications for this site.
                </div>
              )}
              {supported && subscribed && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-[var(--rf-radius-md)] px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Notifications are enabled on this device.
                  </div>
                  <button
                    onClick={handleDisable}
                    disabled={loading}
                    className="px-5 py-2 text-sm font-semibold border border-gray-300 rounded-[var(--rf-radius-md)] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Turning off…' : 'Turn off notifications'}
                  </button>
                </div>
              )}
              {supported && !subscribed && permission !== 'denied' && (
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-[var(--rf-green)] text-white font-semibold rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors shadow-md disabled:opacity-60"
                >
                  <Bell className="w-4 h-4" />
                  {loading ? 'Enabling…' : 'Enable notifications'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inbox */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[var(--rf-navy)] text-base">Recent notifications</h2>
        </div>
        {inboxLoading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : inbox.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <Bell className="w-8 h-8 text-gray-200" />
            No notifications yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {inbox.map(n => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-6 py-4 ${!n.read ? 'bg-green-50/40' : ''}`}
                onClick={() => { if (n.url) window.location.href = n.url; }}
                style={{ cursor: n.url ? 'pointer' : 'default' }}
              >
                <div className="mt-0.5 p-2 rounded-full bg-green-100 shrink-0">
                  <Calendar className="w-4 h-4 text-[var(--rf-green)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--rf-navy)]">{n.title}</p>
                  {n.body && <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{formatTime(n.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
