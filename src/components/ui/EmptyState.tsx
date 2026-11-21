import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[#CBD5E1] bg-white/70 p-8 sm:p-10 text-center backdrop-blur-md shadow-xs">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDF2FE] text-[#2F65F6] shadow-sm">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-bold text-[#1A1F2C]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-[#7E8B9B] leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
