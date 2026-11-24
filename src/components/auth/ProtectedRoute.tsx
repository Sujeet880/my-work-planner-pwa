import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, CheckSquare, FolderKanban, LogOut, Shield } from 'lucide-react';
import { Button } from '../ui/Button';

/**
 * Standard Protected Route (Any Authenticated User)
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen label="Verifying session..." sublabel="Connecting to secure workspace" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * Owner-Only Route Guard
 * Strictly restricts access to the Personal Workspace (Dashboard, Tasks, Projects, Time Tracker, Reports, Settings).
 * If a Client attempts to navigate here, redirects immediately to /portal.
 * If an unauthorized authenticated account lands here, renders a secure Access Denied screen.
 */
export function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOwner, isClient, isLoading, userEmail, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen label="Verifying workspace authorization..." sublabel="Checking owner permissions" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // If user is a client account -> redirect to Client Portal
  if (isClient && !isOwner) {
    return <Navigate to="/portal" replace />;
  }

  // If user is neither owner nor client -> show explicit access boundary
  if (!isOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FD] p-4 text-[#1A1F2C]">
        <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF3E2] text-[#B7791F]">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
            Personal Workspace Access Restricted
          </h1>
          <p className="text-xs text-[#7E8B9B] leading-relaxed">
            You are signed in as <strong className="text-[#1A1F2C]">{userEmail}</strong>. This workspace is reserved exclusively for the account owner.
          </p>
          <div className="rounded-xl bg-[#F8FAFD] border border-[#E9ECF5] p-3 text-xs text-[#475467] text-left space-y-1">
            <p className="font-semibold text-[#1A1F2C]">Invited as a client?</p>
            <p>Please open the project invitation link provided in your email to access your shared project workspace.</p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/portal"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2F65F6] py-2.5 text-xs font-semibold text-white shadow-md hover:bg-[#2554DB] transition-all"
            >
              <FolderKanban className="h-4 w-4" />
              <span>Go to Client Portal</span>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => signOut()}
              className="flex items-center justify-center gap-1.5 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Client Portal Route Guard
 * Allows access to external clients with accepted project memberships, and allows the owner to preview.
 */
export function ClientPortalRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isOwner, isClient, isLoading, userEmail, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen label="Loading Client Portal..." sublabel="Verifying project access permissions" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Allowed for clients and workspace owners
  if (isOwner || isClient) {
    return <>{children}</>;
  }

  // User has no role and 0 shared projects
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FD] p-4 text-[#1A1F2C]">
      <div className="w-full max-w-md rounded-[28px] border border-[#E9ECF5] bg-white p-8 shadow-[0_20px_50px_rgba(25,45,100,0.08)] text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6]">
          <FolderKanban className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#1A1F2C]">
          No Active Shared Projects
        </h1>
        <p className="text-xs text-[#7E8B9B] leading-relaxed">
          You are signed in as <strong className="text-[#1A1F2C]">{userEmail}</strong>, but there are no shared projects associated with this account.
        </p>
        <p className="text-xs text-[#7E8B9B] leading-relaxed">
          If you received an invitation link from a project owner, please open that link directly to join the workspace.
        </p>
        <div className="pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => signOut()}
            className="flex items-center justify-center gap-1.5 text-xs w-full"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FD] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(59,102,245,0.12),rgba(255,255,255,0))] p-4">
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2F65F6] via-[#5F8BFA] to-[#9277FF] text-white shadow-[0_8px_20px_rgba(47,101,246,0.35)] animate-pulse">
          <CheckSquare className="h-7 w-7 text-white stroke-[2.5]" aria-hidden="true" />
        </div>
        <div className="mt-4 text-base font-bold text-[#1A1F2C]">{label}</div>
        <div className="mt-1 text-xs text-[#7E8B9B]">{sublabel}</div>
      </div>
    </div>
  );
}
