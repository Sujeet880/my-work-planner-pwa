/**
 * My Work Planner — PWA Lifecycle & Installation Manager
 * Captures beforeinstallprompt at script evaluation time to ensure events are never lost
 * during client-side navigation. Provides platform detection and standalone mode detection.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'error';

export interface PlatformInfo {
  isChromium: boolean;
  isMacSafari: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isFirefox: boolean;
  browserName: string;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

// Capture event immediately upon module evaluation so early browser events are preserved
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => {
      try {
        listener(deferredPrompt);
      } catch (err) {
        console.error('PWA prompt listener error:', err);
      }
    });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    promptListeners.forEach((listener) => {
      try {
        listener(null);
      } catch (err) {
        console.error('PWA appinstalled listener error:', err);
      }
    });
  });

  // Handle Vite chunk load failures after new production deployments
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error detected, reloading to obtain fresh application bundle:', event);
    window.location.reload();
  });
}

/**
 * Precaches active script and stylesheet assets with the controlling Service Worker
 * so subsequent launches in standalone PWA mode load instantly even with cold or absent network.
 */
export function cacheLoadedAssets(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;

  const assetUrls: string[] = [];
  document.querySelectorAll('script[src], link[rel="stylesheet"]').forEach((el) => {
    const src = el.getAttribute('src') || el.getAttribute('href');
    if (src && src.startsWith('/assets/')) {
      assetUrls.push(src);
    }
  });

  if (assetUrls.length > 0) {
    controller.postMessage({
      type: 'CACHE_ASSETS',
      urls: [...new Set(assetUrls)],
    });
  }
}

/**
 * Registers the minimal app-shell service worker in production and supported preview contexts.
 * Configured with updateViaCache: 'none' and active lifecycle checks on focus/visibility to
 * ensure installed PWAs immediately discover and activate new production deployments.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // 1. Actively check for updates immediately on registration and precache active scripts
        reg.update().catch((err) => console.warn('SW initial update check:', err));
        cacheLoadedAssets();

        // 2. Check for updates whenever the PWA window is focused or becomes visible
        window.addEventListener('focus', () => {
          reg.update().catch(() => {});
          cacheLoadedAssets();
        });

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
            cacheLoadedAssets();
          }
        });

        // 3. Periodic update check for long-running standalone windows (every 30 mins)
        setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 60 * 1000);

        // 4. When a new service worker is installing, tell it to activate immediately once installed
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New worker ready; activate immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('Service worker registration note:', err);
      });

    // 5. Automatically reload app when new service worker takes control (except during active auth flows)
    let isRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isRefreshing) return;
      isRefreshing = true;
      if (!window.location.pathname.startsWith('/auth/')) {
        window.location.reload();
      }
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}

/**
 * Detects whether the application is running inside a standalone PWA window.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const isIOSStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isAndroidStandalone = document.referrer?.includes('android-app://') ?? false;

  return Boolean(isStandaloneMedia || isIOSStandalone || isAndroidStandalone);
}

/**
 * Returns current deferred beforeinstallprompt event if available.
 */
export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/**
 * Subscribes to changes in the deferred install prompt.
 */
export function subscribeToInstallPrompt(
  listener: (prompt: BeforeInstallPromptEvent | null) => void
): () => void {
  promptListeners.add(listener);
  listener(deferredPrompt);
  return () => {
    promptListeners.delete(listener);
  };
}

/**
 * Triggers the browser's native install dialog if a deferred prompt exists.
 */
export async function triggerInstallPrompt(): Promise<{
  outcome: InstallOutcome;
  error?: string;
}> {
  if (!deferredPrompt) {
    return { outcome: 'unavailable' };
  }

  try {
    const promptEvent = deferredPrompt;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice.outcome === 'accepted') {
      deferredPrompt = null;
      promptListeners.forEach((l) => l(null));
      return { outcome: 'accepted' };
    }

    return { outcome: 'dismissed' };
  } catch (err: any) {
    return {
      outcome: 'error',
      error: err?.message || 'Failed to trigger install prompt',
    };
  }
}

/**
 * Analyzes browser and operating system capabilities.
 */
export function detectPlatform(): PlatformInfo {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      isChromium: false,
      isMacSafari: false,
      isIOS: false,
      isAndroid: false,
      isFirefox: false,
      browserName: 'Unknown',
    };
  }

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  const isAndroid = /Android/.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isChromium =
    Boolean((window as any).chrome) ||
    /Chrome|Edg|OPR|Brave/.test(ua) && !/Safari/.test(ua) ||
    (/Chrome/.test(ua) && /Google Inc/.test(navigator.vendor));

  const isMac = /Macintosh|Mac OS X/.test(ua);
  const isSafari =
    /Safari/.test(ua) &&
    !/Chrome|Chromium|Edg|OPR/.test(ua) &&
    /Apple Computer/.test(navigator.vendor);
  const isMacSafari = isMac && isSafari && !isIOS;

  let browserName = 'Browser';
  if (isIOS) browserName = 'iOS Safari';
  else if (isMacSafari) browserName = 'macOS Safari';
  else if (/Edg\//.test(ua)) browserName = 'Microsoft Edge';
  else if (/Chrome\//.test(ua)) browserName = 'Google Chrome';
  else if (isFirefox) browserName = 'Mozilla Firefox';
  else if (isSafari) browserName = 'Safari';

  return {
    isChromium,
    isMacSafari,
    isIOS,
    isAndroid,
    isFirefox,
    browserName,
  };
}
