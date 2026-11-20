import React from 'react';

interface FieldWrapperProps {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
}

export function FieldWrapper({
  id,
  label,
  required,
  helperText,
  error,
  children,
}: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[#202531]">
        {label}
        {required && <span className="ml-0.5 text-[#C2414B]">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-[#C2414B]">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="text-xs text-[#667085]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

const baseInputClasses =
  'w-full rounded-lg border bg-white px-3 text-sm text-[#202531] placeholder:text-[#98A2B3] transition-colors focus:border-[#4968D6] focus:outline-none focus:ring-2 focus:ring-[#7895F2]/30 disabled:bg-[#F0F2F5] disabled:text-[#667085]';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className = '', ...props }: InputProps) {
  return (
    <input
      className={`h-10 ${baseInputClasses} ${
        hasError ? 'border-[#C2414B]' : 'border-[#E4E7EC]'
      } ${className}`}
      {...props}
    />
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function Textarea({ hasError, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`min-h-[84px] py-2.5 ${baseInputClasses} ${
        hasError ? 'border-[#C2414B]' : 'border-[#E4E7EC]'
      } ${className}`}
      {...props}
    />
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError, className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={`h-10 pr-8 ${baseInputClasses} ${
        hasError ? 'border-[#C2414B]' : 'border-[#E4E7EC]'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
