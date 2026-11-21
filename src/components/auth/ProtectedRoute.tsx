import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CheckSquare } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isSupabaseConfigured, isLoading } = useAuth();
  const location = useLocation();

  // 1. Initial Session Resolution / Hydration Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FD] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(59,102,245,0.12),rgba(255,255,255,0))] p-4">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2F65F6] via-[#5F8BFA] to-[#9277FF] text-white shadow-[0_8px_20px_rgba(47,101,246,0.35)] animate-pulse">
            <CheckSquare className="h-7 w-7 text-white stroke-[2.5]" aria-hidden="true" />
          </div>
          <div className="mt-4 text-base font-bold text-[#1A1F2C]">Verifying workspace session...</div>
          <div className="mt-1 text-xs text-[#7E8B9B]">Connecting to secure personal workspace</div>
        </div>
      </div>
    );
  }

  // 2. When Supabase is configured and user is NOT authenticated -> redirect to sign-in
  if (isSupabaseConfigured && !isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // 3. Authenticated (or Milestone 0 preview when Supabase is not yet configured) -> allow access
  return <>{children}</>;
}
