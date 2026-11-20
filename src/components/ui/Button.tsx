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
    'bg-[#4968D6] text-white border border-[#4968D6] hover:bg-[#3D59BE] hover:border-[#3D59BE] disabled:opacity-50',
  secondary:
    'bg-white text-[#202531] border border-[#E4E7EC] hover:bg-[#F6F7F9] hover:border-[#D0D5DD] disabled:opacity-50',
  ghost:
    'bg-transparent text-[#667085] border border-transparent hover:bg-[#F0F2F5] hover:text-[#202531] disabled:opacity-50',
  destructive:
    'bg-[#FCE8E9] text-[#C2414B] border border-[#F5C2C7] hover:bg-[#F8D7DA] disabled:opacity-50',
  success:
    'bg-[#E8F5EF] text-[#16845B] border border-[#BCE3D1] hover:bg-[#D6EFE3] disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs font-medium rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm font-medium rounded-lg gap-2',
  lg: 'h-11 px-5 text-sm font-medium rounded-lg gap-2',
  icon: 'h-10 w-10 p-0 rounded-lg justify-center',
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
      className={`inline-flex items-center justify-center whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
