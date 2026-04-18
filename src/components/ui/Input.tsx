import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leftIcon, error, className, ...rest }, ref) => (
    <div className="w-full">
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full h-12 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400',
            'px-4 text-[15px] font-medium',
            'transition-all duration-200',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            leftIcon && 'pl-11',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-100',
            className,
          )}
          {...rest}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
