import React, { useState } from 'react';
import {
  ExternalLink,
  Laptop,
  Monitor,
  Shield,
  Timer,
  Info,
  X,
  AlertCircle,
  CheckCircle2,
  Terminal,
  FolderOpen,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export function NativeMiniTimerCard() {
  const [isMac] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return /Macintosh|Mac OS X/.test(navigator.userAgent);
  });

  const [launchState, setLaunchState] = useState<'idle' | 'launched' | 'troubleshoot'>('idle');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const handleLaunch = () => {
    if (!isMac) {
      setLaunchState('troubleshoot');
      setShowSetupGuide(true);
      return;
    }

    setLaunchState('launched');
    // Trigger registered custom URL scheme
    window.location.href = 'myworkplanner-minitimer://launch';

    // Show follow-up option if user needs troubleshooting
    setTimeout(() => {
      setLaunchState('troubleshoot');
    }, 2500);
  };

  return (
    <section className="rounded-[24px] border border-[#E9ECF5] bg-white p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)] transition-all">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#1A1F2C]">
                Native macOS Mini Focus Timer
              </h2>
              <span className="rounded-full bg-[#EBF3FF] px-2.5 py-0.5 text-xs font-semibold text-[#2F65F6]">
                macOS Companion App
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#7E8B9B]">
              Lightweight, floating native desktop timer chip that stays pinned above all workspaces,
              full-screen apps, Figma, Chrome, and IDEs.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleLaunch}
              className="font-semibold shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Launch Mini Timer</span>
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowSetupGuide(true)}
              className="text-xs"
            >
              <Info className="h-3.5 w-3.5" />
              <span>Setup Guide</span>
            </Button>
          </div>

          {launchState === 'launched' && (
            <p className="text-[11px] text-[#16845B] flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Invoked custom URL scheme (myworkplanner-minitimer://launch)</span>
            </p>
          )}

          {launchState === 'troubleshoot' && (
            <p className="text-[11px] text-[#7E8B9B]">
              App didn't open?{' '}
              <button
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="text-[#2F65F6] underline font-medium cursor-pointer"
              >
                View companion installation steps
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Verified Capabilities Highlights */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
              <Monitor className="h-4 w-4 text-[#2F65F6]" />
              <span>Floating Chip (NSPanel)</span>
            </div>
            <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
              Stays visible over active windows (VS Code, Chrome, Figma) and across macOS Spaces
              without stealing keyboard focus.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
            <span className="text-[11px] font-semibold text-[#2F65F6]">Non-Activating Window Level</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
              <Shield className="h-4 w-4 text-[#16845B]" />
              <span>PostgreSQL Server Sync</span>
            </div>
            <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
              Single source of truth. Calls the shared PostgreSQL timer RPCs so website and native app
              stay perfectly synchronized.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
            <span className="text-[11px] font-semibold text-[#16845B]">Unified Workspace State</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E9ECF5] bg-[#F8FAFD] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#1A1F2C]">
              <Laptop className="h-4 w-4 text-[#7E8B9B]" />
              <span>Menu Bar Status Ticker</span>
            </div>
            <p className="mt-2 text-xs text-[#7E8B9B] leading-relaxed">
              System status item in the macOS top menu bar displaying live elapsed time with
              quick pause, resume, and open actions.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E9ECF5]">
            <span className="text-[11px] font-semibold text-[#7E8B9B]">macOS 14.0+ Universal</span>
          </div>
        </div>
      </div>

      {/* Companion Setup Guide Modal */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-2xl border border-[#E9ECF5] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9ECF5]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDF2FE] text-[#2F65F6]">
                  <Timer className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-[#1A1F2C]">
                  macOS Mini Focus Timer Companion Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="rounded-lg p-1 text-[#7E8B9B] hover:bg-[#F4F6FA] hover:text-[#1A1F2C] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {!isMac && (
                <div className="rounded-xl border border-[#FEDF89] bg-[#FFFAEB] p-3 text-xs text-[#B54708] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    You appear to be using a non-macOS device. The Mini Focus Timer is a native Swift
                    desktop app designed specifically for macOS 14.0 or later.
                  </span>
                </div>
              )}

              <p className="text-xs text-[#525D73] leading-relaxed">
                The Mini Focus Timer is a standalone native macOS application that registers the custom protocol{' '}
                <code className="bg-[#F1F3F9] px-1 py-0.5 rounded text-[#2F65F6]">myworkplanner-minitimer://</code>.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#1A1F2C]">
                      Install in Applications
                    </h4>
                    <p className="mt-1 text-xs text-[#7E8B9B]">
                      Copy <code>MyWorkPlannerMiniTimer.app</code> into your Mac's Applications folder (<code>/Applications</code> or <code>~/Applications</code>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#1A1F2C]">
                      Open Once to Register Protocol
                    </h4>
                    <p className="mt-1 text-xs text-[#7E8B9B]">
                      Open the app once from Applications or Spotlight. macOS LaunchServices registers the{' '}
                      <code>myworkplanner-minitimer://</code> scheme handler.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#F8FAFD] p-3 rounded-xl border border-[#E9ECF5]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F65F6] text-[10px] font-bold text-white">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#1A1F2C]">
                      Sign In &amp; Sync Timers
                    </h4>
                    <p className="mt-1 text-xs text-[#7E8B9B]">
                      Click Sign In to link your My Work Planner account. The floating chip will automatically reflect active timers.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSetupGuide(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
