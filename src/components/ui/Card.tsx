import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'solid' | 'glass' | 'outline';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  interactive?: boolean;
}

const variants: Record<Variant, string> = {
  solid: 'bg-white border border-ink-100 shadow-card',
  glass: 'bg-white/80 backdrop-blur-xl border border-white/70 shadow-card',
  outline: 'bg-white border-2 border-ink-200',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'solid', interactive, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-3xl',
        variants[variant],
        interactive && 'transition-all duration-200 hover:-translate-y-[1px] hover:shadow-card-lg cursor-pointer',
        className,
      )}
      {...rest}
    />
  ),
);

Card.displayName = 'Card';
