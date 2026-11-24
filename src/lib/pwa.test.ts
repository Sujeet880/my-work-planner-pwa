import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatform,
  isStandalone,
  triggerInstallPrompt,
  subscribeToInstallPrompt,
  getDeferredPrompt,
} from './pwa';

describe('PWA Installation & Platform Detection', () => {
  it('detectPlatform identifies platform characteristics safely in node environment', () => {
    const platform = detectPlatform();
    assert.equal(typeof platform.isChromium, 'boolean');
    assert.equal(typeof platform.isMacSafari, 'boolean');
    assert.equal(typeof platform.isIOS, 'boolean');
    assert.equal(typeof platform.browserName, 'string');
  });

  it('isStandalone defaults to false when window is undefined or in normal browser tab', () => {
    const standalone = isStandalone();
    assert.equal(standalone, false);
  });

  it('triggerInstallPrompt handles unavailable prompt gracefully without throwing', async () => {
    const result = await triggerInstallPrompt();
    assert.equal(result.outcome, 'unavailable');
  });

  it('subscribeToInstallPrompt immediately invokes callback with current prompt status', () => {
    let receivedPrompt: any = 'uncalled';
    const unsubscribe = subscribeToInstallPrompt((p) => {
      receivedPrompt = p;
    });

    assert.equal(receivedPrompt, getDeferredPrompt());
    unsubscribe();
  });

  it('supports unsubscription without throwing errors', () => {
    let callCount = 0;
    const unsubscribe = subscribeToInstallPrompt(() => {
      callCount++;
    });

    assert.equal(callCount, 1);
    unsubscribe();
    // After unsubscribe, nothing throws
    assert.doesNotThrow(() => unsubscribe());
  });
});
