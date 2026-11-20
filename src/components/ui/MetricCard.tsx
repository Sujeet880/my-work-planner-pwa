import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  accentValue?: boolean;
  progressPercent?: number;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  accentValue = false,
  progressPercent,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#667085]">{label}</span>
        {icon && <span className="text-[#98A2B3] shrink-0">{icon}</span>}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums-strict ${
          accentValue ? 'text-[#4968D6]' : 'text-[#202531]'
        }`}
      >
        {value}
      </div>
      {typeof progressPercent === 'number' && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
          <div
            className="h-full rounded-full bg-[#16845B] transition-all"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      )}
      {subtext && <p className="mt-2 text-xs text-[#667085]">{subtext}</p>}
    </div>
  );
}
