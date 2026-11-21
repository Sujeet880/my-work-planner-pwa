import { useState } from 'react';
import { Bell, Plus, Search } from 'lucide-react';

export interface DashboardHeaderProps {
  greeting: string;
  formattedDate: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewTask: () => void;
  notificationMessage?: string;
}

export function DashboardHeader({
  greeting,
  formattedDate,
  searchQuery,
  onSearchChange,
  onNewTask,
  notificationMessage = 'All tasks and systems synced.',
}: DashboardHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNotificationToast, setShowNotificationToast] = useState(false);

  const handleToggleSearch = () => {
    setSearchOpen((prev) => !prev);
    if (searchOpen && searchQuery) {
      onSearchChange('');
    }
  };

  const handleToggleNotification = () => {
    setShowNotificationToast(true);
    setTimeout(() => setShowNotificationToast(false), 3000);
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1F2C]">
            {greeting}
          </h1>
          <p className="mt-1 text-sm font-medium text-[#7E8B9B]">
            {formattedDate}
          </p>
        </div>

        {/* Floating Toolbar Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Search Trigger */}
          <button
            type="button"
            onClick={handleToggleSearch}
            aria-label="Toggle task search"
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all cursor-pointer ${
              searchOpen
                ? 'border-[#2F65F6] bg-white text-[#2F65F6] shadow-[0_4px_12px_rgba(47,101,246,0.15)]'
                : 'border-white/80 bg-white/80 text-[#7E8B9B] shadow-[0_2px_8px_rgba(25,45,100,0.04)] backdrop-blur-md hover:bg-white hover:text-[#1A1F2C] hover:shadow-[0_4px_12px_rgba(25,45,100,0.08)]'
            }`}
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Notifications Button */}
          <div className="relative">
            <button
              type="button"
              onClick={handleToggleNotification}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-[#7E8B9B] shadow-[0_2px_8px_rgba(25,45,100,0.04)] backdrop-blur-md transition-all hover:bg-white hover:text-[#1A1F2C] hover:shadow-[0_4px_12px_rgba(25,45,100,0.08)] cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span
                className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#2F65F6] ring-2 ring-white"
                aria-hidden="true"
              />
            </button>

            {/* Subtle Notification Toast */}
            {showNotificationToast && (
              <div
                role="status"
                className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-[#E9ECF5] bg-white p-3 text-xs text-[#1A1F2C] shadow-[0_8px_24px_rgba(25,45,100,0.12)] backdrop-blur-md animate-in fade-in slide-in-from-top-1"
              >
                <div className="font-semibold text-[#2F65F6]">Workspace Notifications</div>
                <p className="mt-0.5 text-[#7E8B9B]">{notificationMessage}</p>
              </div>
            )}
          </div>

          {/* Primary Action Button: + New task */}
          <button
            type="button"
            onClick={onNewTask}
            aria-label="Create new task"
            className="flex items-center gap-2 rounded-full bg-[#2F65F6] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(47,101,246,0.35)] transition-all hover:bg-[#2554DB] hover:shadow-[0_6px_20px_rgba(47,101,246,0.45)] cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New task</span>
          </button>
        </div>
      </header>

      {/* Expandable Inline Search Bar */}
      {searchOpen && (
        <div className="rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_4px_16px_rgba(25,45,100,0.06)] backdrop-blur-md transition-all">
          <div className="flex items-center gap-2 px-3">
            <Search className="h-4 w-4 text-[#98A2B3] shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter today's tasks by title or description..."
              aria-label="Filter today's tasks"
              className="h-9 flex-1 bg-transparent text-sm text-[#1A1F2C] placeholder:text-[#98A2B3] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-xs font-semibold text-[#7E8B9B] hover:text-[#1A1F2C] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
