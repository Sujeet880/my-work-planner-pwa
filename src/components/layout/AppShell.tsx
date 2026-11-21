import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  ChevronDown,
  Home,
  Layers,
  LogIn,
  Menu,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Square,
  Timer,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { formatClockHHMMSS, getLocalDateISO } from '../../lib/timeMath';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { TaskFormDrawer } from '../tasks/TaskFormDrawer';
import { ManualTimeEntryModal } from '../timer/ManualTimeEntryModal';
import { TimerConfirmationModals } from '../timer/TimerConfirmationModals';
import { Button } from '../ui/Button';

const PRIMARY_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/projects', label: 'Projects', icon: Layers },
  { to: '/time-tracker', label: 'Time Tracker', icon: Timer },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings/google-calendar', label: 'Calendar', icon: Calendar },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function getFormattedTodayHeader(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isMilestone0Preview } = useAuth();
  const {
    tasks,
    activeTimer,
    activeTask,
    activeElapsedSeconds,
    pauseActiveTimer,
    resumeActiveTimer,
    stopAndSaveActiveTimer,
    openCreateTaskDrawer,
    toast,
    dismissToast,
  } = useWorkspace();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const todayIso = getLocalDateISO();
  const todayPendingCount = tasks.filter(
    (t) => !t.isArchived && t.status !== 'completed' && t.scheduledDate === todayIso
  ).length;

  const isItemActive = (to: string): boolean => {
    const path = location.pathname;
    if (to === '/dashboard') {
      return path === '/dashboard' || path === '/';
    }
    if (to === '/tasks') {
      return path === '/tasks' || path.startsWith('/tasks/');
    }
    if (to === '/projects') {
      return path === '/projects' || path.startsWith('/projects/');
    }
    if (to === '/time-tracker') {
      return path === '/time-tracker' || path.startsWith('/time-tracker/');
    }
    if (to === '/reports') {
      return path === '/reports' || path.startsWith('/reports/');
    }
    if (to === '/settings/google-calendar') {
      return (
        path === '/settings/google-calendar' ||
        path.startsWith('/settings/google-calendar/') ||
        path === '/calendar'
      );
    }
    if (to === '/settings') {
      return (
        path === '/settings' ||
        (path.startsWith('/settings/') && !path.startsWith('/settings/google-calendar'))
      );
    }
    return path === to;
  };

  const renderSidebarLinks = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Header */}
        <Link
          to="/dashboard"
          onClick={onNavigate}
          aria-label="My Work Planner Dashboard"
          className="flex items-center gap-3 px-3 py-3.5 rounded-2xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F7FD]"
        >
          {/* Liquid Glass 3D Fluid Orb Logo */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#1E40AF] via-[#3B82F6] to-[#818CF8] shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(0,0,0,0.22),0_6px_16px_rgba(47,101,246,0.32)]">
            <div className="absolute top-1 left-1.5 h-3 w-3 rounded-full bg-white/50 blur-[0.6px]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold tracking-tight text-[#1A1F2C]">
              My Work Planner
            </div>
          </div>
        </Link>

        {/* Clean Single Navigation List */}
        <nav aria-label="Main navigation" className="mt-4 space-y-1.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F7FD] ${
                  active
                    ? 'bg-[#EDF2FE] text-[#2F65F6] shadow-xs'
                    : 'text-[#5A6474] bg-transparent hover:bg-white/70 hover:text-[#1A1F2C]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                      active ? 'text-[#2F65F6]' : 'text-[#6E7687] group-hover:text-[#1A1F2C]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sujit Kumar Profile Card at bottom */}
      <div className="pt-4">
        <Link
          to="/settings"
          onClick={onNavigate}
          aria-label="User settings"
          className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/80 bg-white/60 p-2.5 backdrop-blur-md transition-all hover:bg-white hover:shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F7FD]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDF2FE] text-xs font-bold text-[#2F65F6]">
              S
            </div>
            <div className="min-w-0 text-left">
              <div className="truncate text-xs font-bold text-[#1A1F2C]">Sujit Kumar</div>
              <div className="truncate text-[10px] font-medium text-[#7E8B9B]">Personal Workspace</div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-[#98A2B3] shrink-0" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F7FD] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(59,102,245,0.08),rgba(255,255,255,0))] text-[#1E2433]">
      <OfflineIndicator />

      {/* Floating Translucent Sidebar (Desktop: floating 240px card) */}
      <aside className="fixed top-5 bottom-5 left-5 z-30 hidden w-[240px] flex-col rounded-[28px] border border-white/80 bg-white/70 p-4 shadow-[0_12px_32px_rgba(25,45,100,0.04)] backdrop-blur-2xl lg:flex">
        {renderSidebarLinks()}
      </aside>

      {/* Mobile Top Bar (< lg viewports) */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E9ECF5]/80 bg-white/80 px-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-[#E9ECF5] text-[#1A1F2C] shadow-xs cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#1E40AF] via-[#3B82F6] to-[#818CF8] shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),0_2px_8px_rgba(47,101,246,0.25)]">
              <div className="absolute top-0.5 left-1 h-2 w-2 rounded-full bg-white/50 blur-[0.4px]" />
            </div>
            <span className="text-sm font-bold text-[#1A1F2C]">My Work Planner</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openCreateTaskDrawer(todayIso)}
          className="flex items-center gap-1.5 rounded-full bg-[#2F65F6] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm active:scale-95 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>New task</span>
        </button>
      </header>

      {/* Mobile Slide-over Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-[#1E2433]/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="relative flex h-full w-[264px] max-w-[82vw] flex-col bg-white/95 p-4 shadow-[0_16px_36px_rgba(16,24,40,0.14)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-[#667085] hover:bg-[#F0F2F5] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarLinks(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}

      {/* Main Viewport Content Area */}
      <div className="flex min-h-screen flex-col lg:pl-[272px]">
        <main className={`mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-6 lg:p-8 ${
          activeTimer ? 'pb-36 lg:pb-12' : 'pb-24 lg:pb-12'
        }`}>
          {children}
        </main>
      </div>

      {/* Mobile Sticky Compact Active Timer Bar (above Bottom Navigation) */}
      {activeTimer && activeTask && (
        <div className="fixed inset-x-0 bottom-nav-offset z-30 border-t border-[#2F65F6]/20 bg-white/95 px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(25,45,100,0.08)] backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between gap-2">
            <Link to={`/tasks/${activeTask.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    activeTimer.status === 'running' ? 'bg-[#2F65F6] animate-pulse' : 'bg-[#B7791F]'
                  }`}
                />
                <span className="truncate text-xs font-semibold text-[#1A1F2C]">
                  {activeTask.title}
                </span>
              </div>
              <div className="mt-0.5 text-xs font-bold text-[#2F65F6] tabular-nums-strict">
                {formatClockHHMMSS(activeElapsedSeconds)}
                <span className="ml-1.5 font-normal text-[#7E8B9B]">
                  {activeTimer.status === 'running' ? 'Running' : 'Paused'}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              {activeTimer.status === 'running' ? (
                <button
                  type="button"
                  onClick={pauseActiveTimer}
                  aria-label="Pause active timer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E9ECF5] bg-white text-[#1A1F2C] cursor-pointer"
                >
                  <Pause className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeActiveTimer}
                  aria-label="Resume active timer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2F65F6] text-white cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                </button>
              )}
              <button
                type="button"
                onClick={stopAndSaveActiveTimer}
                aria-label="Stop and save active timer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#F5C2C7] bg-[#FCE8E9] text-[#C2414B] cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (< 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E9ECF5] bg-white/95 backdrop-blur-md pb-safe md:hidden"
      >
        <div className="grid h-16 grid-cols-4 items-center">
          {[
            { to: '/dashboard', label: 'Dashboard', icon: Home },
            { to: '/tasks', label: 'Tasks', icon: CheckSquare },
            { to: '/time-tracker', label: 'Timer', icon: Timer },
            { to: '/reports', label: 'Reports', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F65F6] ${
                  active ? 'text-[#2F65F6]' : 'text-[#7E8B9B] hover:text-[#1A1F2C]'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Global Drawers & Modals */}
      <TaskFormDrawer />
      <ManualTimeEntryModal />
      <TimerConfirmationModals />

      {/* Accessible Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-5 top-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-4 py-3 text-sm text-[#1A1F2C] shadow-[0_12px_32px_rgba(25,45,100,0.12)] backdrop-blur-md"
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              toast.tone === 'success'
                ? 'bg-[#16845B]'
                : toast.tone === 'warning'
                  ? 'bg-[#B7791F]'
                  : 'bg-[#2F65F6]'
            }`}
          />
          <span className="flex-1 font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="text-[#98A2B3] hover:text-[#1A1F2C] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
