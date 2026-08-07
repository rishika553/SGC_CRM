import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-xl select-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-[#2F4F3A] text-white hover:bg-[#243E2E] active:bg-[#1B2F23] focus:ring-[#5E8C61] shadow-xs hover:-translate-y-0.5 border border-[#2F4F3A]/20',
      secondary: 'bg-white text-[#2F4F3A] border border-[#D7DDD7] hover:bg-[#EEF5EF] hover:border-[#5E8C61] focus:ring-[#5E8C61] hover:-translate-y-0.5',
      outline: 'bg-white text-[#27332B] border border-[#E3E8E3] hover:bg-[#EEF5EF] hover:text-[#2F4F3A] hover:border-[#5E8C61] focus:ring-[#5E8C61] hover:-translate-y-0.5',
      ghost: 'bg-transparent text-[#27332B] hover:bg-[#EEF5EF] hover:text-[#2F4F3A] focus:ring-[#5E8C61]',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-xs hover:-translate-y-0.5',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9.5 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
