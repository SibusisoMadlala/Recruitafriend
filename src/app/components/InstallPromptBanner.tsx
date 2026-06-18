import { useEffect, useRef, useState } from 'react';
import { X, Smartphone } from 'lucide-react';

const SHOWN_KEY = 'rf_install_shown_v2';

export function InstallPromptBanner() {
  const [show, setShow] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    // Never show inside the installed app
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as any).standalone;
    if (isStandalone) return;

    // Show once per calendar day
    const today = new Date().toDateString();
    if (localStorage.getItem(SHOWN_KEY) === today) return;

    localStorage.setItem(SHOWN_KEY, today);
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setInstallReady(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function handleInstall() {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        deferredPrompt.current = null;
      }
    } else {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      alert(
        isIos
          ? 'To install on iPhone:\n1. Tap Share (square with arrow)\n2. Tap "Add to Home Screen"\n3. Tap "Add"'
          : 'To install:\n1. Open in Chrome\n2. Tap menu (three dots ⋮)\n3. Tap "Add to Home Screen" or "Install App"'
      );
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '28rem',
          background: '#0A2540',
          color: 'white',
          borderRadius: '1rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          padding: '0.875rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            background: 'rgba(0,200,83,0.2)',
            borderRadius: '0.75rem',
            padding: '0.5rem',
            flexShrink: 0,
          }}
        >
          <Smartphone style={{ width: '1.25rem', height: '1.25rem', color: '#00C853' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.2, margin: 0 }}>
            Get the RecruitFriend App
          </p>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: '0.2rem 0 0' }}>
            Install for faster access
          </p>
        </div>
        <button
          onClick={handleInstall}
          style={{
            background: '#00C853',
            color: 'white',
            border: 'none',
            borderRadius: '0.625rem',
            padding: '0.5rem 0.875rem',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {installReady ? 'Install' : 'How to'}
        </button>
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '0.25rem',
            flexShrink: 0,
            display: 'flex',
          }}
        >
          <X style={{ width: '1rem', height: '1rem' }} />
        </button>
      </div>
    </div>
  );
}
