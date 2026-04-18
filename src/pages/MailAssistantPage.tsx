import { useState } from 'react';
import { ArrowRight, Check, Copy, Flag, Languages, Mail, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Mail size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Mail-assistent</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Klistra in ett kundmail · AI:n genererar färdigt svar på svenska eller engelska · grundat i kunskapsbasen
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} strokeWidth={2.25} />
            <span>Temperature 0 · citations</span>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          {/* Input — wider */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-5">
            <Card variant="glass" className="p-6 flex flex-col min-h-[640px] h-full">
              <div className="flex items-center gap-3 mb-4">
                <IconTile icon={<Mail size={14} strokeWidth={2.25} />} tone="brand" size="sm" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
                  Kundmail
                </span>
                <span className="ml-auto text-[10px] font-semibold text-ink-400 tabular-nums">
                  {customerEmail.length > 0 && `${customerEmail.length} tecken`}
                </span>
              </div>

              <textarea
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Dear El-kretsen,&#10;&#10;I am supporting a UK client with producer responsibility compliance in Sweden..."
                className={cn(
                  'flex-1 resize-none min-h-[420px] bg-white border border-ink-200 rounded-2xl px-5 py-4',
                  'text-[14px] font-medium text-ink-900 placeholder:text-ink-400 leading-relaxed',
                  'focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all',
                )}
                disabled={loading}
              />

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-ink-100/60 border border-ink-100 shadow-inner-soft">
                  <div className="flex items-center gap-1.5 px-2 text-ink-500">
                    <Languages size={14} strokeWidth={2.25} />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Svar</span>
                  </div>
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
                  size="lg"
                >
                  Generera svar
                </Button>
              </div>
            </Card>
          </div>

          {/* Output — dominant */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-7">
            {!result && !loading && !error && <EmptyHero />}
            {loading && <LoadingHero />}
            {error && <ErrorHero message={error} />}

            {result && (
              <div className="space-y-4 animate-slide-up">
                {result.summary && (
                  <Card variant="glass" className="p-5">
                    <div className="flex items-start gap-3">
                      <IconTile icon={<Sparkles size={14} strokeWidth={2.25} />} tone="brand" size="sm" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-700 mb-1">
                          AI:s sammanfattning
                        </p>
                        <p className="text-[13.5px] text-ink-800 leading-relaxed">{result.summary}</p>
                      </div>
                    </div>
                  </Card>
                )}

                <Card variant="glass" className="p-6 sm:p-8 relative overflow-hidden">
                  <div
                    className="absolute -top-20 -right-16 w-60 h-60 rounded-full bg-brand-100/30 blur-3xl pointer-events-none"
                    aria-hidden
                  />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3">
                        <IconTile icon={<Mail size={16} strokeWidth={2.25} />} tone="success" size="md" />
                        <div>
                          <h2 className="text-display text-2xl text-ink-900 leading-tight">Färdigt mailsvar</h2>
                          <p className="text-[11.5px] font-semibold text-ink-400 mt-1">
                            {result.language === 'sv' ? 'Svenska' : 'English'} · redo att kopiera och skicka
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                        leftIcon={<RotateCcw size={14} strokeWidth={2.25} />}
                      >
                        Rensa
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-ink-100 bg-white shadow-card mb-4">
                      <div className="p-6 whitespace-pre-wrap font-medium text-[14px] leading-relaxed text-ink-800 max-h-[520px] overflow-y-auto">
                        {result.reply}
                      </div>
                    </div>

                    {result.gaps.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
                        <div className="flex items-center gap-2 mb-2.5">
                          <TriangleAlert size={14} strokeWidth={2.5} className="text-amber-700" />
                          <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                            Fyll i manuellt innan du skickar ({result.gaps.length})
                          </p>
                        </div>
                        <ul className="space-y-1.5">
                          {result.gaps.map((gap, i) => (
                            <li key={i} className="text-[12.5px] text-amber-900 flex items-start gap-2 leading-relaxed">
                              <Flag size={10} strokeWidth={2.5} className="mt-1.5 shrink-0 text-amber-700" />
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={copyReply}
                        variant={copied ? 'secondary' : 'primary'}
                        size="lg"
                        leftIcon={copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2.25} />}
                      >
                        {copied ? 'Kopierat till urklipp' : 'Kopiera svar'}
                      </Button>

                      {result.sourceFiles.length > 0 && (
                        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                            Källor
                          </span>
                          {result.sourceFiles.slice(0, 4).map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-ink-50 border border-ink-100 text-[11px] font-semibold text-ink-600 truncate max-w-[200px]"
                              title={f}
                            >
                              {f.replace(/\.[^/.]+$/, '')}
                            </span>
                          ))}
                          {result.sourceFiles.length > 4 && (
                            <span className="text-[10px] font-bold text-ink-400">
                              +{result.sourceFiles.length - 4} fler
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyHero() {
  return (
    <Card variant="glass" className="p-12 text-center min-h-[600px] flex flex-col items-center justify-center">
      <IconTile icon={<Mail size={22} strokeWidth={2.25} />} tone="neutral" size="lg" />
      <h3 className="text-display text-3xl text-ink-900 mt-5 mb-2">Inget mail att besvara än</h3>
      <p className="text-[14px] text-ink-500 max-w-md leading-relaxed">
        Klistra in ett kundmail till vänster och klicka <strong className="text-ink-800">Generera svar</strong>.
        AI:n läser mailet, söker i kunskapsbasen och skriver ett färdigt svarsförslag med källhänvisningar.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-md">
        {['Producentansvar', 'WEEE-direktivet', 'AR-tjänster', 'Avgifter 2026'].map((ex) => (
          <span
            key={ex}
            className="text-[11px] font-semibold px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100"
          >
            {ex}
          </span>
        ))}
      </div>
    </Card>
  );
}

function LoadingHero() {
  return (
    <Card variant="glass" className="p-12 text-center min-h-[600px] flex flex-col items-center justify-center">
      <Spinner size={36} className="text-brand-500 mb-5" />
      <p className="text-display text-xl text-ink-900">AI:n läser och formulerar svar…</p>
      <p className="text-[12px] text-ink-500 mt-2">
        Söker i kunskapsbasen · grundar varje påstående i källor · tar vanligtvis 5-15 sekunder
      </p>
    </Card>
  );
}

function ErrorHero({ message }: { message: string }) {
  return (
    <Card variant="glass" className="p-10 min-h-[400px] flex flex-col items-center justify-center text-center">
      <IconTile icon={<TriangleAlert size={18} strokeWidth={2.25} />} tone="danger" size="lg" />
      <h3 className="text-display text-2xl text-ink-900 mt-5 mb-2">Något gick fel</h3>
      <p className="text-[13px] text-red-700 max-w-md font-medium leading-relaxed">{message}</p>
    </Card>
  );
}
