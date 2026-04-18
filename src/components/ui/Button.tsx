import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2';

const variants: Record<Variant, string> = {
  primary:
    'text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(3,105,161,0.6)] ' +
    '[background:linear-gradient(135deg,#06B4E4_0%,#0369A1_55%,#075985_100%)] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_12px_28px_-8px_rgba(3,105,161,0.7)] ' +
    'hover:-translate-y-[1px] active:translate-y-0 active:brightness-95',
  secondary:
    'bg-white text-ink-700 border border-ink-200 shadow-sm hover:border-brand-400 hover:text-brand-600 hover:shadow-md',
  ghost:
    'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger:
    'bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-14 px-7 text-base tracking-wide',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', leftIcon, rightIcon, loading, fullWidth, className, children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        {...rest}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
            <span>Laddar…</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0" aria-hidden>{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0" aria-hidden>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
