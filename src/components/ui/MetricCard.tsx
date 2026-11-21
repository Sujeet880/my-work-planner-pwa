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
    <div className="rounded-[24px] border border-[#E9ECF5] bg-white p-5 sm:p-6 shadow-[0_8px_25px_rgba(25,45,100,0.03)] transition-all hover:shadow-[0_12px_30px_rgba(25,45,100,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">{label}</span>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4F7FD] text-[#2F65F6] shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div
        className={`mt-3 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums-strict ${
          accentValue ? 'text-[#2F65F6]' : 'text-[#1A1F2C]'
        }`}
      >
        {value}
      </div>
      {typeof progressPercent === 'number' && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F0F2F5]">
          <div
            className="h-full rounded-full bg-[#16845B] transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      )}
      {subtext && <p className="mt-2.5 text-xs font-medium text-[#7E8B9B]">{subtext}</p>}
    </div>
  );
}
