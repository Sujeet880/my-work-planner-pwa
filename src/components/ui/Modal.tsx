import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  maxWidthClass = 'max-w-md',
}: ModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1F2C]/35 p-4 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-[0_20px_50px_rgba(25,45,100,0.14)] backdrop-blur-xl animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E9ECF5] px-6 py-5">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-[#1A1F2C]">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs text-[#7E8B9B]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#7E8B9B] hover:bg-[#F0F2F5] hover:text-[#1A1F2C] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children && <div className="px-6 py-5">{children}</div>}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E9ECF5] bg-[#F8FAFD] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
