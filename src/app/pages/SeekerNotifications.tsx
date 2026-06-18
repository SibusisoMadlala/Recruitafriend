import { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import {
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPermission,
  isPushSupported,
} from '../lib/pushNotifications';

export default function SeekerNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<string>(() => getNotificationPermission());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  async function handleEnable() {
    if (!user) return;
    setLoading(true);
    await subscribeToPush(user.id);
    setPermission(getNotificationPermission());
    setLoading(false);
  }

  async function handleDisable() {
    if (!user) return;
    setLoading(true);
    await unsubscribeFromPush(user.id);
    setPermission(getNotificationPermission());
    setLoading(false);
  }

  const supported = isPushSupported();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--rf-navy)]">Notifications</h1>
        <p className="text-gray-500 mt-1">Manage how RecruitFriend alerts you about interviews and activity.</p>
      </div>

      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${permission === 'granted' ? 'bg-green-50' : 'bg-gray-100'}`}>
            {permission === 'granted'
              ? <Bell className="w-6 h-6 text-[var(--rf-green)]" />
              : <BellOff className="w-6 h-6 text-gray-400" />
            }
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

              {supported && permission === 'denied' && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-[var(--rf-radius-md)] px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Notifications are blocked. Go to your browser settings and allow notifications for this site.
                </div>
              )}

              {supported && permission === 'granted' && (
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

              {supported && permission !== 'granted' && permission !== 'denied' && (
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

      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
        <h2 className="font-semibold text-[var(--rf-navy)] text-base mb-3">What you'll be notified about</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            'Interview requests from employers',
            'Interview starting now alerts',
            'Application status updates',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--rf-green)] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
