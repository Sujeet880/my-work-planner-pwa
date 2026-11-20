import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-[#F2D59B] bg-[#FEF3E2] px-4 py-2 text-xs font-medium text-[#B7791F]"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>You are offline. Changes cannot sync until your connection returns.</span>
    </div>
  );
}
