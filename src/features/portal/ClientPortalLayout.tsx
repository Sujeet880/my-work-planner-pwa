import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckSquare,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Inbox,
  Layers,
  LogOut,
  MessageSquare,
  Shield,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { discussionService } from '../../services/discussionService';

export function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, isOwner } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const loadUnread = async () => {
    const res = await discussionService.getUnreadNotificationCount();
    if (res.data !== null) setUnreadCount(res.data);
  };

  const isProjectsActive =
    location.pathname === '/portal' ||
    (location.pathname.startsWith('/portal/projects') && !location.pathname.includes('/inbox'));
  const isInboxActive = location.pathname.startsWith('/portal/inbox');

  return (
    <div className="min-h-screen bg-[#F4F7FC] text-[#1A1F2C]">
      {/* Top Client Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#E9ECF5] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Portal Tag */}
          <div className="flex items-center gap-3">
            <Link to="/portal" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#2F65F6] to-[#5584F8] shadow-md text-white font-black text-sm">
                W
              </div>
              <span className="font-bold tracking-tight text-[#1A1F2C] text-base">
                My Work Planner
              </span>
            </Link>

            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#EDF2FE] px-2.5 py-0.5 text-[11px] font-bold text-[#2F65F6] border border-[#D5E2FD]">
              <Shield className="h-3 w-3" />
              Client Portal
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/portal"
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                isProjectsActive
                  ? 'bg-[#EDF2FE] text-[#2F65F6]'
                  : 'text-[#7E8B9B] hover:bg-[#F8FAFD] hover:text-[#1A1F2C]'
              }`}
            >
              <FolderKanban className="h-4 w-4" />
              <span>Shared Projects</span>
            </Link>

            <Link
              to="/portal/inbox"
              className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                isInboxActive
                  ? 'bg-[#EDF2FE] text-[#2F65F6]'
                  : 'text-[#7E8B9B] hover:bg-[#F8FAFD] hover:text-[#1A1F2C]'
              }`}
            >
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#2F65F6] px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Right User Actions */}
          <div className="flex items-center gap-3">
            {/* Switch to Owner Workspace (Only visible to genuine workspace owner) */}
            {isOwner && (
              <Link
                to="/dashboard"
                className="hidden md:flex items-center gap-1.5 rounded-full border border-[#E9ECF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#7E8B9B] hover:bg-[#F8FAFD] hover:text-[#1A1F2C] transition-all"
                title="Return to your personal workspace"
              >
                <span>Personal Workspace</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}

            {/* User Avatar & Logout */}
            <div className="flex items-center gap-2 border-l border-[#E9ECF5] pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-bold text-white shadow-sm">
                {(user?.email || 'C')[0].toUpperCase()}
              </div>
              <span className="hidden lg:inline-block max-w-[120px] truncate text-xs font-semibold text-[#1A1F2C]">
                {user?.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#FCE8E9] hover:text-[#C2414B] transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
