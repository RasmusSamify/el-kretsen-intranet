import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { submitMailTraining } from '@/lib/api';

interface MailTrainingModalProps {
  open: boolean;
  customerEmail: string;
  aiDraft: string;
  language: 'sv' | 'en';
  onClose: () => void;
  onSubmitted: () => void;
}

export function MailTrainingModal({
  open,
  customerEmail,
  aiDraft,
  language,
  onClose,
  onSubmitted,
}: MailTrainingModalProps) {
  const [correctReply, setCorrectReply] = useState('');
  const [userNote, setUserNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setCorrectReply('');
    setUserNote('');
    setSuccess(false);
    setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = correctReply.trim();
    if (trimmed.length < 20 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMailTraining({
        customer_email: customerEmail,
        ai_draft: aiDraft || null,
        correct_reply: trimmed,
        language,
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
    <Modal open={open} onClose={close} title="Spara ditt svar som stilexempel" size="lg">
      <form onSubmit={submit} className="p-6 space-y-5">
        {success ? (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-bold text-emerald-900 leading-snug">
                Sparat! Ditt svar används framöver som stilexempel.
              </p>
              <p className="text-[12px] text-emerald-800 mt-1 leading-snug">
                Nästa gång ett liknande mail kommer in lär sig AI:n av din ton, struktur och
                formuleringar — fakta hämtas fortfarande från kunskapsbasen.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-xl bg-brand-50 border border-brand-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-800 mb-1">
                <Sparkles size={12} strokeWidth={2.25} />
                Så funkar träningen
              </div>
              <p className="text-[12px] text-brand-900 leading-relaxed">
                AI:n lär sig DIN ton och struktur — inte nya fakta. Siffror, paragrafer och datum
                kommer fortfarande från kunskapsbasen. Liknande framtida kundmail kommer få svar i
                samma stil som det du skriver nedan.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                Så här hade jag svarat istället
              </label>
              <textarea
                value={correctReply}
                onChange={(e) => setCorrectReply(e.target.value)}
                placeholder="Klistra in (eller skriv) det fullständiga svar du skulle ha skickat till kunden…"
                rows={10}
                className="w-full p-3 rounded-xl bg-white border border-ink-200 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all resize-none font-mono"
              />
              <p className="text-[11px] text-ink-400 mt-1.5">
                Inkludera hela mailet inklusive hälsning och signatur — så får AI:n hela kontexten.
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                Kommentar till admin (valfritt)
              </label>
              <textarea
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Vad var det med AI:s utkast som inte stämde? Bara internt — påverkar inte AI-svaret."
                rows={2}
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
            <Button type="submit" loading={submitting} disabled={correctReply.trim().length < 20}>
              Spara som stilexempel
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
