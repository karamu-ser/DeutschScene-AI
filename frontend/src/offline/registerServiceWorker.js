export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW !== 'true') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch(error => {
        console.warn('Service worker registration failed', error);
      });
  });
}
