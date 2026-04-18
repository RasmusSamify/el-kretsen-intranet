import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 20, className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Laddar'}
      className={cn('inline-block rounded-full border-2 border-current border-t-transparent animate-spin', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="AI skriver">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-brand-400"
          style={{ animation: `fadeIn 1.2s ${i * 0.16}s infinite alternate` }}
        />
      ))}
    </span>
  );
}
