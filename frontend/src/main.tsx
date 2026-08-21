import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { registerServiceWorker } from './lib/push';

// Prevent back-forward cache (bfcache) from showing stale protected pages.
// When the browser restores a page from bfcache, React never re-mounts so our
// session validation never runs. Force a reload to trigger the full auth flow.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the web push service worker (safe no-op when unsupported)
registerServiceWorker().catch(() => undefined);
