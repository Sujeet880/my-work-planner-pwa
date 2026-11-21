import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#2F65F6] text-white border border-[#2F65F6] hover:bg-[#2554DB] hover:border-[#2554DB] shadow-[0_2px_8px_rgba(47,101,246,0.25)] hover:shadow-[0_4px_14px_rgba(47,101,246,0.35)] disabled:opacity-50 active:scale-95',
  secondary:
    'bg-white text-[#1A1F2C] border border-[#E9ECF5] hover:bg-[#F8FAFD] hover:border-[#D0D5DD] shadow-[0_1px_2px_rgba(16,24,40,0.04)] disabled:opacity-50 active:scale-95',
  ghost:
    'bg-transparent text-[#6E7687] border border-transparent hover:bg-white/80 hover:text-[#1A1F2C] disabled:opacity-50 active:scale-95',
  destructive:
    'bg-[#FCE8E9] text-[#C2414B] border border-[#F5C2C7] hover:bg-[#F8D7DA] disabled:opacity-50 active:scale-95',
  success:
    'bg-[#E8F5EF] text-[#16845B] border border-[#BCE3D1] hover:bg-[#D6EFE3] disabled:opacity-50 active:scale-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs font-semibold rounded-full gap-1.5',
  md: 'h-10 px-4 text-sm font-semibold rounded-full gap-2',
  lg: 'h-11 px-5 text-sm font-semibold rounded-full gap-2',
  icon: 'h-9 w-9 p-0 rounded-full justify-center',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
