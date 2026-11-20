import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D0D5DD] bg-white px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0F2F5] text-[#667085]">
        {icon}
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-[#202531]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[#667085]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
