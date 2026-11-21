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
      className="fixed inset-0 z-50 flex justify-end bg-[#1A1F2C]/35 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[500px] flex-col bg-white/95 backdrop-blur-2xl shadow-2xl sm:border-l sm:border-[#E9ECF5] animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E9ECF5] px-6 py-5">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-xl font-bold text-[#1A1F2C]">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-[#7E8B9B]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F0F2F5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer && (
          <div className="border-t border-[#E9ECF5] bg-[#F8FAFD] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
