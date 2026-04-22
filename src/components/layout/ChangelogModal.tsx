import { Check, Info, Sparkles } from 'lucide-react';
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
    <Modal open={open} onClose={onClose} title="Vad är nytt i ELvis Hub" size="xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Hero header */}
        <div className="px-8 pt-6 pb-5 bg-gradient-to-br from-ink-900 via-ink-900 to-brand-700 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Sparkles size={22} strokeWidth={1.75} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                Nuvarande version
              </p>
              <div className="flex items-baseline gap-3 mt-1">
                <p className="text-display text-3xl leading-none tabular-nums">
                  v{CURRENT_VERSION}
                </p>
                <p className="text-[13px] font-semibold text-white/70">
                  {formatDate(CHANGELOG[0].date)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-white/8 border border-white/10">
            <Info size={14} className="text-white/60 shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-[12.5px] text-white/85 leading-relaxed">
              Här samlar vi alla förbättringar och nya funktioner vi lägger till i ELvis Hub.
              Senaste uppdateringen står överst. Klicka på versionsnumret längst ner i sidomenyn när du vill komma hit.
            </p>
          </div>
        </div>

        {/* Changelog list */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-7">
          {CHANGELOG.map((entry, idx) => (
            <article key={entry.version} className="relative">
              <header className="mb-3">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="text-display text-2xl text-ink-900 tabular-nums leading-none">
                    v{entry.version}
                  </span>
                  {idx === 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                      <Check size={10} strokeWidth={3} />
                      Senaste
                    </span>
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    {formatDate(entry.date)}
                  </span>
                </div>
                <h3 className="text-display text-[22px] text-ink-900 leading-tight">
                  {entry.title}
                </h3>
                {entry.summary && (
                  <p className="text-[14px] text-ink-600 leading-relaxed mt-2">{entry.summary}</p>
                )}
              </header>

              <ul className="space-y-2.5 mt-4">
                {entry.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-ink-50/60 border border-ink-100"
                  >
                    <span className="w-5 h-5 rounded-full bg-white border border-ink-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={11} strokeWidth={2.5} className="text-brand-500" />
                    </span>
                    <span className="text-[13.5px] text-ink-700 leading-relaxed flex-1">{h}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-ink-50 border-t border-ink-100 text-center">
          <p className="text-[11px] font-semibold text-ink-500">
            Bygger du något nytt med oss? Hör av dig till{' '}
            <a href="mailto:info@samify.se" className="font-bold text-ink-900 underline">
              info@samify.se
            </a>
          </p>
        </div>
      </div>
    </Modal>
  );
}
