import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  leftIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
};

export function Badge({ variant = 'neutral', leftIcon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {leftIcon && <span className="inline-flex" aria-hidden>{leftIcon}</span>}
      {children}
    </span>
  );
}
