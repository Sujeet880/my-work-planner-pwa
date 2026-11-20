import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, footer, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#202531]/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[480px] flex-col bg-white shadow-[0_16px_36px_rgba(16,24,40,0.14)] sm:border-l sm:border-[#E4E7EC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E4E7EC] px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-lg font-semibold text-[#202531]">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F0F2F5] hover:text-[#202531] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="border-t border-[#E4E7EC] bg-[#F6F7F9] px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}
