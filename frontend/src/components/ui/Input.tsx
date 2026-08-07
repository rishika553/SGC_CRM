import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-surface-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full h-9 bg-white border border-surface-200 rounded-lg px-3 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15 transition-all duration-150',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/15',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-surface-400 pointer-events-none flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
        {!error && helperText && <span className="text-xs text-surface-500">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
