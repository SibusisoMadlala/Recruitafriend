import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Clear notification badge whenever the app is opened or focused
function clearBadge() {
  if ('clearAppBadge' in navigator) (navigator as any).clearAppBadge().catch(() => {});
}
clearBadge();
document.addEventListener('visibilitychange', () => { if (!document.hidden) clearBadge(); });
