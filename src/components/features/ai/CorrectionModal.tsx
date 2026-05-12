import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, FileText, FileX, Search } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { submitCorrection, type CorrectionType } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface CorrectionModalProps {
  open: boolean;
  question: string;
  originalAnswer: string;
  citedSources: string[]; // sourceFiles från ELvis-svaret
  onClose: () => void;
  onSubmitted: () => void;
}

interface KbSource {
  filename: string;
}

const CHOICES: Array<{ type: CorrectionType; label: string; help: string; icon: typeof FileX }> = [
  {
    type: 'wrong_source',
    label: 'Fel källa hänvisades',
    help: 'ELvis citerade en källa, men rätt svar finns i ett annat dokument.',
    icon: FileX,
  },
  {
    type: 'outdated_source',
    label: 'Källan är inaktuell',
    help: 'Källan ELvis citerade är gammal eller har ersatts av nyare text.',
    icon: AlertCircle,
  },
  {
    type: 'missing_in_kb',
    label: 'Saknas i kunskapsbasen',
    help: 'Svaret finns inte i kunskapsbasen alls — ett dokument behöver läggas till.',
    icon: FileText,
  },
];

export function CorrectionModal({
  open,
  question,
  originalAnswer,
  citedSources,
  onClose,
  onSubmitted,
}: CorrectionModalProps) {
  const [type, setType] = useState<CorrectionType | null>(null);
  const [citedSource, setCitedSource] = useState<string>('');
  const [suggestedSource, setSuggestedSource] = useState<string>('');
  const [userNote, setUserNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allSources, setAllSources] = useState<KbSource[]>([]);

  useEffect(() => {
    if (!open) return;
    setType(null);
    setCitedSource(citedSources[0] ?? '');
    setSuggestedSource('');
    setUserNote('');
    setSuccess(false);
    setError(null);

    supabase.rpc('list_kb_sources').then(({ data }) => {
      if (data) setAllSources(data as KbSource[]);
    });
  }, [open, citedSources]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!type || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitCorrection({
        question,
        original_answer: originalAnswer,
        correction_type: type,
        cited_source: type === 'outdated_source' ? citedSource : type === 'wrong_source' ? citedSource || null : null,
        suggested_source: type === 'wrong_source' ? suggestedSource : null,
        user_note: userNote || null,
      });
      setSuccess(true);
      onSubmitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Rätta detta svar" size="md">
      <form onSubmit={submit} className="p-6 space-y-5">
        {success ? (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-bold text-emerald-900 leading-snug">
                Tack! Rättelsen är registrerad.
              </p>
              <p className="text-[12px] text-emerald-800 mt-1 leading-snug">
                Den dyker upp i Granskning där admin kan följa upp.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-ink-500 leading-relaxed">
              Hjälp ELvis att svara rätt nästa gång. Välj vad som var fel — alla rättelser hanteras av
              admin för att hålla kunskapsbasen saklig.
            </p>

            <fieldset className="space-y-2">
              <legend className="text-[10px] font-black uppercase tracking-wider text-ink-500 mb-1.5">
                Vad var fel?
              </legend>
              {CHOICES.map((c) => {
                const Icon = c.icon;
                const selected = type === c.type;
                return (
                  <label
                    key={c.type}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      selected
                        ? 'border-ink-900 bg-ink-50 ring-2 ring-ink-100'
                        : 'border-ink-200 hover:border-ink-400 hover:bg-ink-50/60',
                    )}
                  >
                    <input
                      type="radio"
                      name="correction-type"
                      value={c.type}
                      checked={selected}
                      onChange={() => setType(c.type)}
                      className="mt-0.5 accent-ink-900"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] font-bold text-ink-900">
                        <Icon size={13} strokeWidth={2.25} />
                        {c.label}
                      </div>
                      <p className="text-[11.5px] text-ink-500 mt-0.5 leading-snug">{c.help}</p>
                    </div>
                  </label>
                );
              })}
            </fieldset>

            {type === 'outdated_source' && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                  Vilken källa är inaktuell?
                </label>
                <SourceSelect value={citedSource} onChange={setCitedSource} options={citedSources.length ? citedSources : allSources.map((s) => s.filename)} />
              </div>
            )}

            {type === 'wrong_source' && (
              <>
                {citedSources.length > 0 && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                      Vilken källa hänvisades fel (valfritt)?
                    </label>
                    <SourceSelect value={citedSource} onChange={setCitedSource} options={citedSources} optional />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                    Rätt källa är…
                  </label>
                  <SourceSelect
                    value={suggestedSource}
                    onChange={setSuggestedSource}
                    options={allSources.map((s) => s.filename)}
                    placeholder="Välj rätt källa ur kunskapsbasen"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                Kommentar (valfritt)
              </label>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Vad var det som var fel? Bara informativ — påverkar inte ELvis svar direkt."
                rows={3}
                className="w-full p-3 rounded-xl bg-white border border-ink-200 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all resize-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[13px] text-red-700 leading-snug">{error}</p>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            {success ? 'Stäng' : 'Avbryt'}
          </Button>
          {!success && (
            <Button
              type="submit"
              loading={submitting}
              disabled={
                !type ||
                (type === 'wrong_source' && !suggestedSource.trim()) ||
                (type === 'outdated_source' && !citedSource.trim())
              }
            >
              Skicka rättelse
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function SourceSelect({
  value,
  onChange,
  options,
  placeholder,
  optional,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div className="relative">
      <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-ink-200 text-[13px] font-medium text-ink-800 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all appearance-none"
      >
        {optional && <option value="">— välj vid behov —</option>}
        {!optional && !value && <option value="">{placeholder ?? 'Välj källa'}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
