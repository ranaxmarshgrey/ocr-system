import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { initOfflineSync } from './lib/offlineQueue';

/* ── Register PWA service worker ──────────────────────── */
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onRegisteredSW(swUrl, registration) {
    // Check for SW updates every hour
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use');
  },
});

/* ── Initialize offline queue sync ────────────────────── */
initOfflineSync();

/* ── Render app ───────────────────────────────────────── */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
