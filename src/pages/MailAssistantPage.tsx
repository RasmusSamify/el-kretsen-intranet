import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Flag,
  Languages,
  Mail,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Button, Card, IconTile, Spinner } from '@/components/ui';
import { mailAssistant, type MailAssistantResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

export function MailAssistantPage() {
  const [customerEmail, setCustomerEmail] = useState('');
  const [language, setLanguage] = useState<'sv' | 'en'>('sv');
  const [result, setResult] = useState<MailAssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const disabled = !customerEmail.trim() || loading;

  const generate = async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const response = await mailAssistant({
        customerEmail: customerEmail.trim(),
        responseLanguage: language,
      });
      setResult(response);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    if (!result?.reply) return;
    try {
      await navigator.clipboard.writeText(result.reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 pb-8">
        {/* Left — Input */}
        <Card variant="glass" className="p-6 flex flex-col min-h-[560px]">
          <div className="flex items-center gap-3 mb-4">
            <IconTile icon={<Mail size={16} strokeWidth={2.25} />} tone="brand" size="md" />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-ink-900 text-[15px] leading-none">Kundmail</h2>
              <p className="text-[11px] font-semibold text-ink-400 mt-1">
                Klistra in hela mailet från kunden — svenska eller engelska.
              </p>
            </div>
          </div>

          <textarea
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Dear El-kretsen,&#10;&#10;I am supporting a UK client with producer responsibility compliance in Sweden..."
            className={cn(
              'flex-1 resize-none min-h-[340px] bg-white border border-ink-200 rounded-2xl px-4 py-3',
              'text-[14px] font-medium text-ink-900 placeholder:text-ink-400 leading-relaxed',
              'focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all',
            )}
            disabled={loading}
          />

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 p-1 rounded-xl bg-ink-100/60 border border-ink-100 shadow-inner-soft">
              <Languages size={14} className="text-ink-500 ml-2 shrink-0" strokeWidth={2.25} />
              <button
                onClick={() => setLanguage('sv')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all',
                  language === 'sv' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                Svenska
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all',
                  language === 'en' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                English
              </button>
            </div>

            <Button
              onClick={generate}
              disabled={disabled}
              loading={loading}
              rightIcon={<ArrowRight size={16} strokeWidth={2.25} />}
              className="sm:ml-auto"
            >
              Generera svar
            </Button>
          </div>
        </Card>

        {/* Right — Output */}
        <Card variant="glass" className="p-6 flex flex-col min-h-[560px]">
          <div className="flex items-center gap-3 mb-4">
            <IconTile icon={<Sparkles size={16} strokeWidth={2.25} />} tone="success" size="md" />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-ink-900 text-[15px] leading-none">AI-genererat svar</h2>
              <p className="text-[11px] font-semibold text-ink-400 mt-1">
                Grundat i kunskapsbasen · temperature 0 · redo att kopiera
              </p>
            </div>
            {result && (
              <Button variant="ghost" size="sm" onClick={reset} leftIcon={<RotateCcw size={14} strokeWidth={2.25} />}>
                Rensa
              </Button>
            )}
          </div>

          {!result && !loading && !error && <EmptyState />}
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}

          {result && (
            <div className="flex-1 flex flex-col min-h-0">
              {result.summary && (
                <div className="mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-1">
                    Sammanfattning
                  </p>
                  <p className="text-[13px] text-ink-800 leading-relaxed">{result.summary}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto rounded-2xl border border-ink-100 bg-white">
                <div className="p-4 whitespace-pre-wrap font-medium text-[14px] leading-relaxed text-ink-800">
                  {result.reply}
                </div>
              </div>

              {result.gaps.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-2 flex items-center gap-1.5">
                    <TriangleAlert size={12} strokeWidth={2.5} />
                    Fyll i manuellt innan du skickar
                  </p>
                  <ul className="space-y-1">
                    {result.gaps.map((gap, i) => (
                      <li key={i} className="text-[12.5px] text-amber-900 flex items-start gap-1.5">
                        <Flag size={10} strokeWidth={2.5} className="mt-1 shrink-0 text-amber-700" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.sourceFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Källor</span>
                  {result.sourceFiles.slice(0, 6).map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-ink-50 border border-ink-100 text-[11px] font-semibold text-ink-600 truncate max-w-[220px]"
                      title={f}
                    >
                      {f.replace(/\.[^/.]+$/, '')}
                    </span>
                  ))}
                  {result.sourceFiles.length > 6 && (
                    <span className="text-[10px] font-bold text-ink-400">
                      +{result.sourceFiles.length - 6} fler
                    </span>
                  )}
                </div>
              )}

              <Button
                onClick={copyReply}
                fullWidth
                variant={copied ? 'secondary' : 'primary'}
                leftIcon={copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2.25} />}
                className="mt-4"
              >
                {copied ? 'Kopierat till urklipp' : 'Kopiera svar'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <IconTile icon={<Mail size={18} strokeWidth={2.25} />} tone="neutral" size="md" />
      <h3 className="text-display text-xl text-ink-900 mt-4 mb-1">Inget mail att besvara än</h3>
      <p className="text-[13px] text-ink-500 max-w-xs leading-relaxed">
        Klistra in ett kundmail till vänster och klicka "Generera svar". AI:n analyserar mailet,
        söker i kunskapsbasen och producerar ett färdigt svar.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <Spinner size={28} className="text-brand-500 mb-4" />
      <p className="text-display text-lg text-ink-900">AI:n läser och formulerar svar…</p>
      <p className="text-[12px] text-ink-500 mt-1">Detta tar vanligtvis 5-15 sekunder.</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <IconTile icon={<TriangleAlert size={18} strokeWidth={2.25} />} tone="danger" size="md" />
      <h3 className="text-display text-xl text-ink-900 mt-4 mb-1">Något gick fel</h3>
      <p className="text-[12.5px] text-red-700 max-w-sm leading-relaxed font-medium">{message}</p>
    </div>
  );
}
