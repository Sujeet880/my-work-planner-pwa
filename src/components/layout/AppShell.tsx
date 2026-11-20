import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  Clock,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  Menu,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Square,
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
  { to: '/dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'My Tasks', mobileLabel: 'Tasks', icon: CheckSquare },
  { to: '/time-tracker', label: 'Time Tracker', mobileLabel: 'Timer', icon: Clock },
  { to: '/reports', label: 'Reports', mobileLabel: 'Reports', icon: BarChart3 },
];

const SECONDARY_NAV = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
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
    globalSearchQuery,
    setGlobalSearchQuery,
    toast,
    dismissToast,
  } = useWorkspace();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const todayIso = getLocalDateISO();
  const todayPendingCount = tasks.filter(
    (t) => !t.isArchived && t.status !== 'completed' && t.scheduledDate === todayIso
  ).length;

  const isOnPrimaryTimerView =
    location.pathname === '/' ||
    location.pathname === '/dashboard' ||
    location.pathname === '/time-tracker';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.pathname.startsWith('/tasks')) {
      navigate('/tasks');
    }
  };

  const renderSidebarLinks = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="flex h-16 items-center gap-2.5 border-b border-[#E4E7EC] px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4968D6] text-white">
          <CheckSquare className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#202531]">My Work Planner</div>
          <div className="text-[11px] text-[#667085]">Personal Workspace</div>
        </div>
      </div>

      {/* Navigation groups */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
            Workspace
          </div>
          <ul className="space-y-1">
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EDF1FF] text-[#4968D6]'
                          : 'text-[#667085] hover:bg-[#F0F2F5] hover:text-[#202531]'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    {item.to === '/tasks' && todayPendingCount > 0 && (
                      <span className="rounded-md bg-[#F0F2F5] px-1.5 py-0.5 text-[11px] font-semibold text-[#667085] tabular-nums-strict">
                        {todayPendingCount}
                      </span>
                    )}
                    {item.to === '/time-tracker' && activeTimer?.status === 'running' && (
                      <span
                        className="h-2 w-2 rounded-full bg-[#16845B]"
                        aria-label="Timer running"
                      />
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
            Organize &amp; System
          </div>
          <ul className="space-y-1">
            {SECONDARY_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EDF1FF] text-[#4968D6]'
                          : 'text-[#667085] hover:bg-[#F0F2F5] hover:text-[#202531]'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Account / Auth Footer */}
      <div className="border-t border-[#E4E7EC] p-3">
        <div className="rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] p-3">
          <div className="text-xs font-semibold text-[#202531]">
            {isMilestone0Preview ? 'Milestone 0 Preview' : 'Workspace Owner'}
          </div>
          <p className="mt-0.5 text-[11px] text-[#667085]">
            {isMilestone0Preview
              ? 'Supabase Auth pending M1 setup'
              : 'Private single-owner session'}
          </p>
          <Link
            to="/sign-in"
            onClick={onNavigate}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#4968D6] hover:underline"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>View Sign-In Screen</span>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#202531]">
      <OfflineIndicator />

      {/* Desktop Fixed Left Sidebar (232px) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-[#E4E7EC] bg-white lg:block">
        {renderSidebarLinks()}
      </aside>

      {/* Mobile / Tablet Slide-over Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-[#202531]/35 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="relative flex h-full w-[264px] max-w-[82vw] flex-col bg-white shadow-[0_16px_36px_rgba(16,24,40,0.14)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-2.5 top-3 flex h-10 w-10 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F0F2F5] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarLinks(() => setMobileMenuOpen(false))}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-h-screen flex-col lg:pl-[232px]">
        {/* Top Bar (64px on desktop, 56px on mobile) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[#E4E7EC] bg-white/95 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F0F2F5] lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm text-[#667085] sm:flex whitespace-nowrap">
              <Calendar className="h-4 w-4 text-[#98A2B3]" aria-hidden="true" />
              <span>{getFormattedTodayHeader()}</span>
            </div>

            <span className="truncate text-sm font-semibold text-[#202531] sm:hidden">
              My Work Planner
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop/Tablet Search */}
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="h-9 w-56 rounded-lg border border-[#E4E7EC] bg-[#F6F7F9] pl-9 pr-3 text-sm text-[#202531] placeholder:text-[#98A2B3] transition-colors focus:border-[#4968D6] focus:bg-white focus:outline-none lg:w-64"
              />
            </form>

            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>

            <Button
              variant="primary"
              size="sm"
              className="h-9 sm:h-10 sm:px-4"
              onClick={() => openCreateTaskDrawer(getLocalDateISO())}
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </Button>
          </div>
        </header>

        {/* Honest Milestone 0 Preview Notice */}
        {isMilestone0Preview && (
          <div className="border-b border-[#E4E7EC] bg-[#EDF1FF]/60 px-4 py-1.5 text-xs text-[#202531] sm:px-6">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <p className="truncate">
                <strong className="font-semibold text-[#4968D6]">M0 Preview</strong>
                {' — '}Local preview data; Supabase Auth &amp; Google Calendar pending setup.
              </p>
              <Link
                to="/settings"
                className="shrink-0 font-medium text-[#4968D6] hover:underline whitespace-nowrap"
              >
                Setup Status
              </Link>
            </div>
          </div>
        )}

        {/* Desktop/Tablet Persistent Global Active Timer Strip (shown on secondary pages) */}
        {activeTimer && activeTask && !isOnPrimaryTimerView && (
          <div className="hidden border-b border-[#4968D6]/20 bg-white px-6 py-2.5 md:block">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    activeTimer.status === 'running' ? 'bg-[#4968D6]' : 'bg-[#B7791F]'
                  }`}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#4968D6]">
                  {activeTimer.status === 'running' ? 'Active Timer' : 'Paused'}
                </span>
                <Link
                  to={`/tasks/${activeTask.id}`}
                  className="truncate text-sm font-medium text-[#202531] hover:text-[#4968D6]"
                >
                  {activeTask.title}
                </Link>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-sm font-semibold text-[#202531] tabular-nums-strict">
                  {formatClockHHMMSS(activeElapsedSeconds)}
                </span>
                {activeTimer.status === 'running' ? (
                  <Button variant="secondary" size="sm" onClick={pauseActiveTimer}>
                    <Pause className="h-3.5 w-3.5" />
                    <span>Pause</span>
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={resumeActiveTimer}>
                    <Play className="h-3.5 w-3.5" />
                    <span>Resume</span>
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={stopAndSaveActiveTimer}>
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Page Viewport */}
        <main
          className={`mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 ${
            activeTimer ? 'pb-36 md:pb-8' : 'pb-24 md:pb-8'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Sticky Compact Active Timer Bar (above Bottom Navigation) */}
      {activeTimer && activeTask && (
        <div className="fixed inset-x-0 bottom-nav-offset z-30 border-t border-[#4968D6]/25 bg-white/95 px-3 py-2 shadow-[0_-4px_12px_rgba(16,24,40,0.06)] backdrop-blur-sm md:hidden">
          <div className="flex items-center justify-between gap-2">
            <Link to={`/tasks/${activeTask.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    activeTimer.status === 'running' ? 'bg-[#4968D6]' : 'bg-[#B7791F]'
                  }`}
                />
                <span className="truncate text-xs font-semibold text-[#202531]">
                  {activeTask.title}
                </span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-[#4968D6] tabular-nums-strict">
                {formatClockHHMMSS(activeElapsedSeconds)}
                <span className="ml-1.5 font-normal text-[#667085]">
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E4E7EC] bg-white text-[#202531] cursor-pointer"
                >
                  <Pause className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeActiveTimer}
                  aria-label="Resume active timer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4968D6] text-white cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={stopAndSaveActiveTimer}
                aria-label="Stop and save active timer"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F5C2C7] bg-[#FCE8E9] text-[#C2414B] cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (< 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E4E7EC] bg-white/95 backdrop-blur-sm pb-safe md:hidden"
      >
        <div className="grid h-16 grid-cols-4 items-center">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-[#4968D6]' : 'text-[#667085]'
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.mobileLabel}</span>
              </NavLink>
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
          className="fixed right-4 top-20 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm text-[#202531] shadow-[0_6px_20px_rgba(16,24,40,0.12)]"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              toast.tone === 'success'
                ? 'bg-[#16845B]'
                : toast.tone === 'warning'
                  ? 'bg-[#B7791F]'
                  : 'bg-[#4968D6]'
            }`}
          />
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="text-[#98A2B3] hover:text-[#202531] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
