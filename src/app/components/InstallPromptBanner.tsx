import { useEffect, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';

const SHOWN_KEY = 'rf_install_shown_date';
const INSTALLED_KEY = 'rf_app_installed';

export function InstallPromptBanner() {
  const [show, setShow] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as any).standalone;
    if (isStandalone) return;
    if (localStorage.getItem(INSTALLED_KEY) === 'true') return;

    const today = new Date().toDateString();
    if (localStorage.getItem(SHOWN_KEY) === today) return;

    // Small delay so the page has rendered before the banner slides in
    const t = setTimeout(() => {
      setShow(true);
      localStorage.setItem(SHOWN_KEY, today);
    }, 500);

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setInstallReady(true);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, 'true');
      setShow(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        deferredPrompt.current = null;
        localStorage.setItem(INSTALLED_KEY, 'true');
      }
    } else {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIos) {
        alert(
          'To install RecruitFriend on iPhone:\n' +
          '1. Tap the Share button (square with arrow)\n' +
          '2. Scroll down and tap "Add to Home Screen"\n' +
          '3. Tap "Add"'
        );
      } else {
        alert(
          'To install RecruitFriend:\n' +
          '1. Open this site in Chrome\n' +
          '2. Tap the menu (three dots ⋮)\n' +
          '3. Tap "Add to Home Screen" or "Install App"'
        );
      }
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center">
      <div className="w-full max-w-md bg-[#0A2540] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-[#00C853]/20 rounded-xl p-2 flex-shrink-0">
          <Smartphone className="w-5 h-5 text-[#00C853]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">Get the RecruitFriend App</p>
          <p className="text-xs text-white/60 mt-0.5 truncate">Faster access — install in seconds</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-[#00C853] hover:bg-[#00B548] text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-colors"
        >
          {installReady ? 'Install' : 'How to'}
        </button>
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss install prompt"
          className="text-white/50 hover:text-white flex-shrink-0 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
