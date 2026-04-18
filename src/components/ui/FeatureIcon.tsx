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

const gradients: Record<Tone, string> = {
  brand:
    'bg-[linear-gradient(135deg,#06B4E4_0%,#0284C7_55%,#075985_100%)] text-white ' +
    'shadow-[0_4px_12px_-4px_rgba(3,105,161,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
  emerald:
    'bg-[linear-gradient(135deg,#34D399_0%,#059669_55%,#065F46_100%)] text-white ' +
    'shadow-[0_4px_12px_-4px_rgba(5,150,105,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
  amber:
    'bg-[linear-gradient(135deg,#FBBF24_0%,#D97706_55%,#92400E_100%)] text-white ' +
    'shadow-[0_4px_12px_-4px_rgba(217,119,6,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
  violet:
    'bg-[linear-gradient(135deg,#A78BFA_0%,#7C3AED_55%,#5B21B6_100%)] text-white ' +
    'shadow-[0_4px_12px_-4px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
  rose:
    'bg-[linear-gradient(135deg,#FB7185_0%,#E11D48_55%,#9F1239_100%)] text-white ' +
    'shadow-[0_4px_12px_-4px_rgba(225,29,72,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
  slate:
    'bg-[linear-gradient(135deg,#94A3B8_0%,#475569_55%,#1E293B_100%)] text-white ' +
    'shadow-[0_4px_12px_-4px_rgba(71,85,105,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
};

const sizes: Record<Size, string> = {
  sm: 'w-9 h-9 rounded-xl [&_svg]:w-[16px] [&_svg]:h-[16px]',
  md: 'w-11 h-11 rounded-2xl [&_svg]:w-[18px] [&_svg]:h-[18px]',
  lg: 'w-14 h-14 rounded-2xl [&_svg]:w-[22px] [&_svg]:h-[22px]',
  xl: 'w-16 h-16 rounded-[20px] [&_svg]:w-[26px] [&_svg]:h-[26px]',
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
      {/* subtle top-highlight */}
      <span
        className="absolute inset-x-1 top-0.5 h-[40%] rounded-[inherit] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)',
          borderTopLeftRadius: 'inherit',
          borderTopRightRadius: 'inherit',
        }}
      />
      {/* the icon itself */}
      <span className="relative z-10 [&_svg]:stroke-[2.25]">{icon}</span>
    </span>
  );
}
