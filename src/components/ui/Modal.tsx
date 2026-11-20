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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#202531]/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_16px_36px_rgba(16,24,40,0.14)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E4E7EC] px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-[#202531]">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-[#667085]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F0F2F5] hover:text-[#202531] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-[#E4E7EC] bg-[#F6F7F9] px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
