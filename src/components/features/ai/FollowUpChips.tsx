import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowUpChipsProps {
  chips: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
}

export function FollowUpChips({ chips, disabled, onPick }: FollowUpChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 animate-fade-in pl-11">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-ink-400">
        <Sparkles size={11} strokeWidth={2} />
        Förslag på följdfrågor
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(chip)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'text-[12px] font-semibold text-ink-700',
              'bg-white border border-ink-200',
              'hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all shadow-sm',
            )}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
