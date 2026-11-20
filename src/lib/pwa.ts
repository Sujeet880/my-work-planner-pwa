/**
 * Registers the minimal app-shell service worker in production and supported preview contexts.
 * Never throws or blocks rendering if service workers are unavailable.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Non-fatal in environments where service worker registration is restricted
    });
  });
}
