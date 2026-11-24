import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Smartphone,
  Info,
  X,
  Compass,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../ui/Button';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const {
    canInstall,
    isInstalled,
    platform,
    isPrompting,
    installOutcome,
    install,
    openStandalone,
  } = usePWAInstall();

  const [showManualGuide, setShowManualGuide] = useState(false);

  // 1. Already installed in standalone mode
  if (isInstalled) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EF] px-2.5 py-1 text-xs font-semibold text-[#16845B]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Installed</span>
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#BCE3D1] bg-[#E8F5EF] px-3.5 py-2 text-xs font-semibold text-[#16845B]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>App Installed</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={openStandalone}
          className="text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Open App</span>
        </Button>
      </div>
    );
  }

  // 2. Browser native install prompt is ready (Chromium beforeinstallprompt)
  if (canInstall) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button
          variant="primary"
          size={compact ? 'sm' : 'md'}
          disabled={isPrompting}
          onClick={async () => {
            await install();
          }}
          className="shadow-sm font-semibold"
        >
          <Download className="h-4 w-4" />
          <span>{isPrompting ? 'Opening Prompt...' : 'Install My Work Planner'}</span>
        </Button>

        {installOutcome === 'dismissed' && !compact && (
          <p className="text-[11px] text-[#7E8B9B]">
            Installation prompt was cancelled. Click again or use your browser address bar.
          </p>
        )}
      </div>
    );
  }

  // 3. Native prompt not available (Safari macOS, iOS Safari, or Chromium without active prompt)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={compact ? 'secondary' : 'primary'}
          size={compact ? 'sm' : 'md'}
          onClick={() => setShowManualGuide(true)}
          className="font-semibold"
        >
          <Download className="h-4 w-4" />
          <span>Install My Work Planner</span>
        </Button>

        {!compact && (
          <button
            type="button"
            onClick={() => setShowManualGuide(true)}
            className="text-xs font-medium text-[#2F65F6] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Info className="h-3.5 w-3.5" />
            <span>How to install on {platform.browserName}</span>
          </button>
        )}
      </div>

      {/* Manual Installation Guide Modal */}
      {showManualGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-[#E9ECF5] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9ECF5]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDF2FE] text-[#2F65F6]">
                  <Download className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-[#1A1F2C]">
                  Install on {platform.browserName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="rounded-lg p-1 text-[#7E8B9B] hover:bg-[#F4F6FA] hover:text-[#1A1F2C] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {platform.isMacSafari ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#525D73] leading-relaxed">
                    macOS Safari supports installing web apps directly to your Mac Dock:
                  </p>
                  <ol className="space-y-2.5 text-xs text-[#1A1F2C]">
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        1
                      </span>
                      <span>
                        In Safari's top menu bar, click <strong>File</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        2
                      </span>
                      <span>
                        Select <strong>Add to Dock...</strong> from the dropdown menu.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        3
                      </span>
                      <span>
                        Confirm the name <strong>My Work Planner</strong> and click <strong>Add</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : platform.isIOS ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#525D73] leading-relaxed">
                    Install My Work Planner on your iPhone or iPad:
                  </p>
                  <ol className="space-y-2.5 text-xs text-[#1A1F2C]">
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        1
                      </span>
                      <span>
                        Tap the <strong>Share</strong> button (square with arrow) at the bottom of Safari.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        2
                      </span>
                      <span>
                        Scroll down and tap <strong>Add to Home Screen</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        3
                      </span>
                      <span>
                        Tap <strong>Add</strong> in the top right corner.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#525D73] leading-relaxed">
                    Install directly from your browser's address bar:
                  </p>
                  <ol className="space-y-2.5 text-xs text-[#1A1F2C]">
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        1
                      </span>
                      <span>
                        Look at the right side of the address bar for the <strong>Install</strong> icon (computer with down arrow).
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                        2
                      </span>
                      <span>
                        Alternatively, open the browser menu (<strong>⋮</strong> or <strong>⋯</strong>) and select <strong>Install My Work Planner</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowManualGuide(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
