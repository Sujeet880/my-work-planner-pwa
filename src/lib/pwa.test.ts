import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPlatform,
  isStandalone,
  triggerInstallPrompt,
  subscribeToInstallPrompt,
  getDeferredPrompt,
  cacheLoadedAssets,
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

  it('validates Service Worker architecture and assets manifest', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const swPath = path.resolve(process.cwd(), 'public/sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');

    // Asserts cache version has been bumped
    assert.ok(swContent.includes("const CACHE_NAME = 'mwp-shell-v5'"));

    // Asserts navigation requests are separated from subresource requests
    assert.ok(swContent.includes("request.mode === 'navigate'"));

    // Asserts static assets under /assets/ are explicitly protected from returning index.html
    assert.ok(swContent.includes("url.pathname.startsWith('/assets/')"));
    assert.ok(!swContent.includes("url.pathname.startsWith('/assets/') && caches.match('/')"));

    // Asserts manifest exists and contains standalone display mode
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');

    // Asserts pwa.ts configures updateViaCache: 'none' and focus-based updates
    const pwaSource = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/pwa.ts'), 'utf-8');
    assert.ok(pwaSource.includes("updateViaCache: 'none'"));
    assert.ok(pwaSource.includes("reg.update()"));
    assert.ok(pwaSource.includes("controllerchange"));
    assert.ok(pwaSource.includes("SKIP_WAITING"));
    assert.ok(pwaSource.includes("cacheLoadedAssets"));
    assert.ok(swContent.includes("CACHE_ASSETS"));
  });

  it('cacheLoadedAssets executes safely without throwing in non-browser environments', () => {
    assert.doesNotThrow(() => cacheLoadedAssets());
  });
});
