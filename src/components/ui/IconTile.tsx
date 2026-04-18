import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold' | 'silver' | 'bronze';

interface IconTileProps {
  icon: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  danger: 'bg-red-50 text-red-600 ring-red-100',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
  gold: 'bg-amber-50 text-amber-600 ring-amber-200',
  silver: 'bg-ink-100 text-ink-600 ring-ink-300',
  bronze: 'bg-orange-50 text-orange-600 ring-orange-200',
};

const sizes = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
};

export function IconTile({ icon, tone = 'brand', size = 'md', className }: IconTileProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center ring-1 shrink-0 shadow-sm',
        tones[tone],
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {icon}
    </span>
  );
}
