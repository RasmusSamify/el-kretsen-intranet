import { useRef, useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import type { Citation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CitationChipProps {
  citation: Citation;
  index: number;
}

export function CitationChip({ citation, index }: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayName = citation.filename.replace(/\.[^/.]+$/, '');

  return (
    <span ref={ref} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full',
          'text-[11px] font-bold',
          'bg-brand-50 text-brand-700 border border-brand-100',
          'hover:bg-brand-100 hover:border-brand-200 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        )}
        title={`${displayName} · stycke ${citation.chunkIndex + 1}`}
      >
        <FileText size={10} strokeWidth={2.5} />
        <span>{index}</span>
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute z-40 bottom-full left-0 mb-2 w-80 max-w-[90vw] text-left animate-fade-in"
          style={{ transform: 'translateX(-20%)' }}
        >
          <span className="block bg-white rounded-2xl shadow-xl border border-ink-100 overflow-hidden">
            <span className="flex items-center justify-between px-4 py-2.5 border-b border-ink-100 bg-ink-50">
              <span className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="text-brand-500 shrink-0" strokeWidth={2.25} />
                <span className="text-xs font-bold text-ink-800 truncate">{displayName}</span>
                <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider shrink-0">
                  · stycke {citation.chunkIndex + 1}
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-ink-400 hover:text-ink-700 transition-colors"
                aria-label="Stäng"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </span>
            <span className="block p-4 text-[12px] text-ink-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {citation.text}
            </span>
            <span className="block px-4 py-2 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Relevans: {Math.round(citation.similarity * 100)} %
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
