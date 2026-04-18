import { useState } from 'react';
import {
  Calculator,
  Leaf,
  TriangleAlert,
  ArrowRight,
  RotateCcw,
  Info,
  BadgeCheck,
} from 'lucide-react';
import { Button, Card, IconTile, Input, Spinner } from '@/components/ui';
import { calculateFee, type FeeResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

const EXAMPLES = [
  'Kylskåp',
  'Elcykelbatteri Li-jon 25 kg',
  'Laptop',
  'Monitor 48 tum',
  'Dammsugare',
];

export function FeeCalculatorPage() {
  const [desc, setDesc] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<'st' | 'kg'>('st');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FeeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = !desc.trim() || !quantity || Number(quantity) <= 0 || loading;

  const submit = async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await calculateFee({
        productDescription: desc.trim(),
        quantity: Number(quantity),
        unit,
      });
      setResult(response);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 pb-8">
        {/* Input */}
        <Card variant="glass" className="p-6 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-3 mb-5">
            <IconTile icon={<Calculator size={16} strokeWidth={2.25} />} tone="brand" size="md" />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-ink-900 text-[15px] leading-none">Avgifts-kalkylator</h2>
              <p className="text-[11px] font-semibold text-ink-400 mt-1">
                AI:n hittar rätt kod och räknar ut total-avgift.
              </p>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="text-eyebrow block mb-2">Produkt</label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="T.ex. 'Li-jon batteri 25 kg' eller 'Monitor 48 tum'"
                onKeyDown={(e) => e.key === 'Enter' && !disabled && submit()}
                disabled={loading}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setDesc(ex)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-ink-200 text-ink-600 hover:border-brand-400 hover:text-brand-700 transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label className="text-eyebrow block mb-2">Antal / vikt</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0.01"
                  step="0.01"
                  onKeyDown={(e) => e.key === 'Enter' && !disabled && submit()}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-eyebrow block mb-2">Enhet</label>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-ink-100/60 border border-ink-100 h-12">
                  <button
                    onClick={() => setUnit('st')}
                    className={cn(
                      'px-4 h-full rounded-lg text-[13px] font-bold transition-all',
                      unit === 'st'
                        ? 'bg-white text-brand-700 shadow-sm'
                        : 'text-ink-500 hover:text-ink-800',
                    )}
                  >
                    st
                  </button>
                  <button
                    onClick={() => setUnit('kg')}
                    className={cn(
                      'px-4 h-full rounded-lg text-[13px] font-bold transition-all',
                      unit === 'kg'
                        ? 'bg-white text-brand-700 shadow-sm'
                        : 'text-ink-500 hover:text-ink-800',
                    )}
                  >
                    kg
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-ink-50 border border-ink-100 flex items-start gap-2">
              <Info size={14} className="text-ink-400 shrink-0 mt-0.5" strokeWidth={2.25} />
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                AI:n matchar produkten mot prislistan och räknar total = antal × avgift per enhet.
                Grön variant visas om den finns (10% lägre avgift vid grön dokumentation).
              </p>
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={disabled}
            loading={loading}
            fullWidth
            rightIcon={<ArrowRight size={16} strokeWidth={2.25} />}
            className="mt-5"
          >
            Räkna ut avgift
          </Button>
        </Card>

        {/* Result */}
        <Card variant="glass" className="p-6 flex flex-col min-h-[480px]">
          {!result && !loading && !error && <EmptyResult />}
          {loading && <LoadingResult />}
          {error && <ErrorResult message={error} />}

          {result && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <IconTile
                    icon={result.matched ? <BadgeCheck size={16} strokeWidth={2.25} /> : <TriangleAlert size={16} strokeWidth={2.25} />}
                    tone={result.matched ? 'success' : 'warning'}
                    size="md"
                  />
                  <div>
                    <h2 className="font-bold text-ink-900 text-[15px] leading-none">
                      {result.matched ? 'Avgift uträknad' : 'Osäker matchning'}
                    </h2>
                    <p className="text-[11px] font-semibold text-ink-400 mt-1">
                      {result.matched ? 'Grundat i kunskapsbasen' : 'Kontrollera manuellt'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={reset} leftIcon={<RotateCcw size={14} strokeWidth={2.25} />}>
                  Rensa
                </Button>
              </div>

              <p className="text-[13px] text-ink-700 leading-relaxed mb-5">{result.reasoning}</p>

              {result.primary && <FeeBreakdownCard breakdown={result.primary} tone="primary" />}
              {result.green && (
                <div className="mt-3">
                  <FeeBreakdownCard breakdown={result.green} tone="green" />
                </div>
              )}

              {result.warning && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <TriangleAlert size={14} className="text-amber-700 shrink-0 mt-0.5" strokeWidth={2.25} />
                  <p className="text-[12.5px] text-amber-900 leading-relaxed">{result.warning}</p>
                </div>
              )}

              {result.citations.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Källor</span>
                  {result.citations.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-ink-50 border border-ink-100 text-[11px] font-semibold text-ink-600"
                      title={c}
                    >
                      {c.replace(/\.[^/.]+$/, '')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FeeBreakdownCard({
  breakdown,
  tone,
}: {
  breakdown: { code: string; productName: string; unitFee: number; feeUnit: string; totalFee: number };
  tone: 'primary' | 'green';
}) {
  const isGreen = tone === 'green';
  return (
    <div
      className={cn(
        'p-5 rounded-2xl border',
        isGreen
          ? 'bg-emerald-50/60 border-emerald-200'
          : 'bg-gradient-to-br from-white to-brand-50/30 border-brand-100 shadow-card',
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        {isGreen ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
            <Leaf size={10} strokeWidth={2.5} />
            Grön avgift
          </span>
        ) : (
          <span className="text-[10px] font-black uppercase tracking-wider text-brand-700">
            Kod
          </span>
        )}
        <span
          className={cn(
            'text-display text-2xl tabular-nums',
            isGreen ? 'text-emerald-800' : 'text-brand-700',
          )}
        >
          {breakdown.code}
        </span>
      </div>

      <p className="text-[13px] font-semibold text-ink-800 leading-snug mb-4">
        {breakdown.productName}
      </p>

      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Avgift</p>
          <p className="text-[15px] font-bold text-ink-800 tabular-nums">
            {breakdown.unitFee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} {breakdown.feeUnit}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Totalt</p>
          <p
            className={cn(
              'text-display tabular-nums leading-none',
              isGreen ? 'text-emerald-800 text-3xl' : 'text-brand-700 text-4xl',
            )}
          >
            {breakdown.totalFee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Exkl. moms</p>
        </div>
      </div>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <IconTile icon={<Calculator size={18} strokeWidth={2.25} />} tone="neutral" size="md" />
      <h3 className="text-display text-xl text-ink-900 mt-4 mb-1">Räkna ut El-kretsen-avgift</h3>
      <p className="text-[13px] text-ink-500 max-w-xs leading-relaxed">
        Skriv in en produkt och antal/vikt. AI:n hittar rätt produktkod och räknar ut
        totalbeloppet direkt från prislistan.
      </p>
    </div>
  );
}

function LoadingResult() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <Spinner size={26} className="text-brand-500 mb-4" />
      <p className="text-display text-lg text-ink-900">Söker rätt produktkod…</p>
    </div>
  );
}

function ErrorResult({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <IconTile icon={<TriangleAlert size={18} strokeWidth={2.25} />} tone="danger" size="md" />
      <h3 className="text-display text-xl text-ink-900 mt-4 mb-1">Kunde inte räkna</h3>
      <p className="text-[12.5px] text-red-700 max-w-sm font-medium leading-relaxed">{message}</p>
    </div>
  );
}
