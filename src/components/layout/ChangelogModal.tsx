import { Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui';
import { CHANGELOG, CURRENT_VERSION } from '@/lib/version';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Uppdateringar & versioner" size="lg">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-ink-900 text-white">
          <Sparkles size={16} strokeWidth={1.75} className="text-white/70 shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
              Nuvarande version
            </p>
            <p className="text-display text-2xl leading-none mt-1 tabular-nums">
              v{CURRENT_VERSION}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
            {formatDate(CHANGELOG[0].date)}
          </span>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {CHANGELOG.map((entry, idx) => (
            <div key={entry.version} className="relative">
              {idx === 0 && (
                <span className="absolute -left-1 top-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                  Senaste
                </span>
              )}
              <div className={idx === 0 ? 'pt-7' : 'pt-1'}>
                <div className="flex items-baseline gap-3 mb-2">
                  <h3 className="text-display text-xl text-ink-900 tabular-nums">
                    v{entry.version}
                  </h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    {formatDate(entry.date)}
                  </span>
                </div>
                <p className="text-[13.5px] font-bold text-ink-700 mb-3">{entry.title}</p>
                <ul className="space-y-1.5">
                  {entry.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="text-[12.5px] text-ink-600 leading-relaxed pl-4 relative"
                    >
                      <span className="absolute left-0 top-[8px] w-1.5 h-1.5 rounded-full bg-ink-400" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 text-center mt-6 pt-6 border-t border-ink-100">
          ELvis Hub · byggt av Samify
        </p>
      </div>
    </Modal>
  );
}
