import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './fonts';
import './index.css';
import { armSplashFailsafe } from './splash';

armSplashFailsafe();

// The app always opens on the globe: start fetching its chunk (and three.js) right now, in parallel with
// React's first render, instead of waiting for <Suspense> to request it. App's lazy() import reuses this promise.
void import('./components/globe/QuranGlobe');

// Offline support (production only, so the dev server is never served stale files)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
