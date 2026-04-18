import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';
type Size = 'sm' | 'md' | 'lg' | 'xl';

interface FeatureIconProps {
  icon: ReactNode;
  tone?: Tone;
  size?: Size;
  className?: string;
}

/**
 * Refined gradient palette — softer, more elegant than primary colour stops.
 * Each tone uses two adjacent hues with a gentle diagonal and a subtle inner
 * ring shadow to give depth without the "web1.0 bevel" look.
 */
const gradients: Record<Tone, string> = {
  brand:
    'bg-[linear-gradient(140deg,#38BDF8_0%,#0284C7_60%,#075985_100%)] text-white ' +
    'ring-1 ring-inset ring-white/15 ' +
    'shadow-[0_6px_16px_-6px_rgba(3,105,161,0.45)]',
  emerald:
    'bg-[linear-gradient(140deg,#6EE7B7_0%,#10B981_60%,#047857_100%)] text-white ' +
    'ring-1 ring-inset ring-white/15 ' +
    'shadow-[0_6px_16px_-6px_rgba(16,185,129,0.40)]',
  amber:
    'bg-[linear-gradient(140deg,#FCD34D_0%,#F59E0B_60%,#B45309_100%)] text-white ' +
    'ring-1 ring-inset ring-white/20 ' +
    'shadow-[0_6px_16px_-6px_rgba(245,158,11,0.40)]',
  violet:
    'bg-[linear-gradient(140deg,#C4B5FD_0%,#8B5CF6_60%,#6D28D9_100%)] text-white ' +
    'ring-1 ring-inset ring-white/20 ' +
    'shadow-[0_6px_16px_-6px_rgba(139,92,246,0.40)]',
  rose:
    'bg-[linear-gradient(140deg,#FDA4AF_0%,#F43F5E_60%,#BE123C_100%)] text-white ' +
    'ring-1 ring-inset ring-white/20 ' +
    'shadow-[0_6px_16px_-6px_rgba(244,63,94,0.40)]',
  slate:
    'bg-[linear-gradient(140deg,#CBD5E1_0%,#64748B_60%,#334155_100%)] text-white ' +
    'ring-1 ring-inset ring-white/15 ' +
    'shadow-[0_6px_16px_-6px_rgba(71,85,105,0.40)]',
};

const sizes: Record<Size, string> = {
  sm: 'w-9 h-9 rounded-xl [&_svg]:w-[18px] [&_svg]:h-[18px]',
  md: 'w-11 h-11 rounded-2xl [&_svg]:w-[20px] [&_svg]:h-[20px]',
  lg: 'w-14 h-14 rounded-2xl [&_svg]:w-[26px] [&_svg]:h-[26px]',
  xl: 'w-16 h-16 rounded-[20px] [&_svg]:w-[30px] [&_svg]:h-[30px]',
};

export function FeatureIcon({ icon, tone = 'brand', size = 'md', className }: FeatureIconProps) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 overflow-hidden',
        gradients[tone],
        sizes[size],
        className,
      )}
      aria-hidden
    >
      {/* Top gloss — extremely subtle */}
      <span
        className="absolute inset-x-0 top-0 h-[45%] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)',
          borderTopLeftRadius: 'inherit',
          borderTopRightRadius: 'inherit',
        }}
      />
      <span className="relative z-10">{icon}</span>
    </span>
  );
}
