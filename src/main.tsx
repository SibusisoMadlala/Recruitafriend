import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Clear badge + close all notifications when app is opened or focused
function clearNotifications() {
  if ('clearAppBadge' in navigator) (navigator as any).clearAppBadge().catch(() => {});
  navigator.serviceWorker.ready.then(reg => {
    reg.getNotifications().then(list => list.forEach(n => n.close()));
  }).catch(() => {});
}
clearNotifications();
document.addEventListener('visibilitychange', () => { if (!document.hidden) clearNotifications(); });
