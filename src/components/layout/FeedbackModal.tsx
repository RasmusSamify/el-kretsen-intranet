import { useState } from 'react';
import { Lightbulb, Bug, HelpCircle, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { submitFeedback, type FeedbackCategory } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CategoryOption {
  value: FeedbackCategory;
  label: string;
  description: string;
  icon: typeof Lightbulb;
}

const CATEGORIES: CategoryOption[] = [
  {
    value: 'forbattring',
    label: 'Förbättringsförslag',
    description: 'Idé på en ny funktion eller förändring',
    icon: Lightbulb,
  },
  {
    value: 'bugg',
    label: 'Bugg / problem',
    description: 'Något beter sig inte som det ska',
    icon: Bug,
  },
  {
    value: 'fraga',
    label: 'Fråga',
    description: 'Något du vill veta om hur ELvis fungerar',
    icon: HelpCircle,
  },
  {
    value: 'annat',
    label: 'Annat',
    description: 'Något som inte passar i kategorierna ovan',
    icon: MoreHorizontal,
  },
];

const MIN_LENGTH = 5;
const MAX_LENGTH = 4000;

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState<FeedbackCategory>('forbattring');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCategory('forbattring');
    setMessage('');
    setError(null);
    setSubmitted(false);
  };

  const handleClose = () => {
    onClose();
    // Vänta tills modalen stängts innan vi rensar (undvik flicker)
    setTimeout(reset, 200);
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < MIN_LENGTH) {
      setError(`Skriv minst ${MIN_LENGTH} tecken så vi förstår vad du menar.`);
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`Meddelandet är för långt (max ${MAX_LENGTH} tecken).`);
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback(category, trimmed);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel — försök igen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Skicka feedback" size="lg">
      {submitted ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 mx-auto flex items-center justify-center">
            <CheckCircle2 size={24} strokeWidth={2} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-ink-900 text-[15px]">Tack för din feedback!</p>
            <p className="text-[13px] text-ink-500 mt-1">
              Vi får ett mejl direkt och återkopplar om vi behöver mer info.
            </p>
          </div>
          <div className="pt-2">
            <Button variant="secondary" onClick={handleClose}>
              Stäng
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 py-1">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 mb-2">
              Vad gäller det?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((opt) => {
                const Icon = opt.icon;
                const active = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      'flex flex-col items-start text-left p-3 rounded-xl border transition-all',
                      active
                        ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgba(2,132,199,0.08)]'
                        : 'border-ink-100 bg-white hover:border-ink-200',
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center mb-2',
                        active ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-500',
                      )}
                    >
                      <Icon size={14} strokeWidth={2} />
                    </div>
                    <span className="text-[13px] font-bold text-ink-900 leading-none">{opt.label}</span>
                    <span className="text-[11px] text-ink-500 mt-1 leading-snug">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="feedback-message"
              className="block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 mb-2"
            >
              Berätta lite mer
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={6}
              placeholder="Vad fungerar bra? Vad skulle du vilja se? Beskriv så detaljerat du orkar."
              className="w-full px-4 py-3 rounded-xl border border-ink-100 bg-white text-[14px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              disabled={submitting}
            />
            <div className="flex justify-between mt-1.5 text-[11px] text-ink-400 tabular-nums">
              <span>{message.trim().length < MIN_LENGTH ? `Minst ${MIN_LENGTH} tecken` : ''}</span>
              <span>
                {message.length} / {MAX_LENGTH}
              </span>
            </div>
          </div>

          {error && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={handleClose} disabled={submitting}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || message.trim().length < MIN_LENGTH}
            >
              {submitting ? 'Skickar…' : 'Skicka feedback'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
