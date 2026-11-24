import { useCallback, useEffect, useState } from 'react';
import {
  detectPlatform,
  isStandalone,
  subscribeToInstallPrompt,
  triggerInstallPrompt,
  type InstallOutcome,
  type PlatformInfo,
} from '../lib/pwa';

export interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  platform: PlatformInfo;
  isPrompting: boolean;
  installOutcome: InstallOutcome | null;
  install: () => Promise<InstallOutcome>;
  openStandalone: () => void;
}

export function usePWAInstall(): PWAInstallState {
  const [hasPrompt, setHasPrompt] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandalone());
  const [isPrompting, setIsPrompting] = useState<boolean>(false);
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome | null>(null);
  const [platform] = useState<PlatformInfo>(() => detectPlatform());

  useEffect(() => {
    // 1. Subscribe to global deferred beforeinstallprompt listener
    const unsubscribe = subscribeToInstallPrompt((prompt) => {
      setHasPrompt(Boolean(prompt));
    });

    // 2. Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setHasPrompt(false);
      setInstallOutcome('accepted');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 3. Re-evaluate display-mode changes (e.g. user installed in another tab)
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    mediaQuery?.addEventListener?.('change', handleMediaChange);

    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    setIsPrompting(true);
    setInstallOutcome(null);

    const res = await triggerInstallPrompt();
    setIsPrompting(false);
    setInstallOutcome(res.outcome);

    if (res.outcome === 'accepted') {
      setIsInstalled(true);
    }

    return res.outcome;
  }, []);

  const openStandalone = useCallback(() => {
    // Navigate to root in standalone context or reload
    window.location.href = '/';
  }, []);

  return {
    canInstall: hasPrompt && !isInstalled,
    isInstalled,
    isIOS: platform.isIOS,
    platform,
    isPrompting,
    installOutcome,
    install,
    openStandalone,
  };
}
