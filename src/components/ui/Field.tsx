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
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-[#7E8B9B]">
        {label}
        {required && <span className="ml-1 text-[#E03137]">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-[#E03137]">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-help`} className="text-xs text-[#7E8B9B]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

const baseInputClasses =
  'w-full rounded-xl border bg-[#F8FAFD] px-3.5 text-sm text-[#1A1F2C] placeholder:text-[#9AA6B8] transition-all focus:bg-white focus:border-[#2F65F6] focus:outline-none focus:ring-4 focus:ring-[#2F65F6]/10 disabled:bg-[#F0F2F5] disabled:text-[#7E8B9B]';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError, className = '', ...props }: InputProps) {
  return (
    <input
      className={`h-10 ${baseInputClasses} ${
        hasError ? 'border-[#E03137] ring-1 ring-[#E03137]' : 'border-[#E9ECF5]'
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
        hasError ? 'border-[#E03137] ring-1 ring-[#E03137]' : 'border-[#E9ECF5]'
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
        hasError ? 'border-[#E03137] ring-1 ring-[#E03137]' : 'border-[#E9ECF5]'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
