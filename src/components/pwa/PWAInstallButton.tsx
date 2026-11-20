import { Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../ui/Button';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { canInstall, isInstalled, isIOS, install } = usePWAInstall();

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-[#BCE3D1] bg-[#E8F5EF] px-3 py-2 text-xs font-medium text-[#16845B]">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Installed as Standalone App
      </div>
    );
  }

  if (canInstall) {
    return (
      <Button
        variant={compact ? 'secondary' : 'primary'}
        size={compact ? 'sm' : 'md'}
        onClick={() => void install()}
      >
        <Download className="h-4 w-4" />
        <span>Install App</span>
      </Button>
    );
  }

  if (compact) return null;

  return (
    <p className="text-xs text-[#667085]">
      {isIOS
        ? 'On iOS Safari, tap the Share button and choose "Add to Home Screen" to install.'
        : 'Install prompt appears automatically in supported Chromium browsers when served over HTTPS.'}
    </p>
  );
}
