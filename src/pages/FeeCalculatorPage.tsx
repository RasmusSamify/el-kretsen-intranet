import { useState } from 'react';
import {
  Calculator,
  Leaf,
  TriangleAlert,
  ArrowRight,
  RotateCcw,
  Info,
  BadgeCheck,
  Sparkles,
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
  'Induktionshäll',
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Calculator size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Avgifts-kalkylator</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                AI-driven prissökning över hela El-kretsens prislista · temperature 0 · grundat i prislistan
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} strokeWidth={2.25} />
            <span>Realtid</span>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          {/* Input side — compact */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-4">
            <Card variant="glass" className="p-6 lg:sticky lg:top-5">
              <div className="flex items-center gap-3 mb-5">
                <IconTile icon={<Calculator size={14} strokeWidth={2.25} />} tone="brand" size="sm" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
                  Ange produkt
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-eyebrow block mb-2">Produkt</label>
                  <Input
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="T.ex. 'Li-jon batteri 25 kg'"
                    onKeyDown={(e) => e.key === 'Enter' && !disabled && submit()}
                    disabled={loading}
                  />
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setDesc(ex)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white border border-ink-200 text-ink-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/40 transition-all"
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
                  <Info size={13} className="text-ink-400 shrink-0 mt-0.5" strokeWidth={2.25} />
                  <p className="text-[11.5px] text-ink-600 leading-relaxed">
                    AI:n matchar produkten mot prislistan och räknar total = antal × avgift.
                    Grön variant visas separat (−10% vid grön dokumentation).
                  </p>
                </div>

                <Button
                  onClick={submit}
                  disabled={disabled}
                  loading={loading}
                  fullWidth
                  size="lg"
                  rightIcon={<ArrowRight size={16} strokeWidth={2.25} />}
                >
                  Räkna ut avgift
                </Button>
              </div>
            </Card>
          </div>

          {/* Result side — dominant */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-8">
            {!result && !loading && !error && <EmptyHero />}
            {loading && <LoadingHero />}
            {error && <ErrorHero message={error} />}

            {result && (
              <div className="space-y-4 animate-slide-up">
                {/* Hero result card */}
                {result.primary ? (
                  <HeroResultCard
                    breakdown={result.primary}
                    green={result.green}
                    matched={result.matched}
                    reasoning={result.reasoning}
                    quantity={Number(quantity)}
                    unitInput={unit}
                  />
                ) : (
                  <Card variant="glass" className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <IconTile
                        icon={<TriangleAlert size={16} strokeWidth={2.25} />}
                        tone="warning"
                        size="md"
                      />
                      <div>
                        <h2 className="text-display text-2xl text-ink-900 leading-tight">
                          Ingen säker matchning
                        </h2>
                        <p className="text-[12px] font-semibold text-ink-400 mt-1">
                          AI:n hittade ingen entydig kod i prislistan
                        </p>
                      </div>
                    </div>
                    <p className="text-[13px] text-ink-700 leading-relaxed">{result.reasoning}</p>
                  </Card>
                )}

                {/* Action row — clear + source info */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={reset}
                    leftIcon={<RotateCcw size={14} strokeWidth={2.25} />}
                  >
                    Ny beräkning
                  </Button>
                  {result.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        Källa
                      </span>
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
                  {result.warning && (
                    <div className="flex-1 min-w-[200px] ml-auto flex items-center gap-2 p-2 px-3 rounded-xl bg-amber-50 border border-amber-200">
                      <TriangleAlert
                        size={13}
                        className="text-amber-700 shrink-0"
                        strokeWidth={2.25}
                      />
                      <p className="text-[11.5px] text-amber-900 leading-snug">{result.warning}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroResultCard({
  breakdown,
  green,
  matched,
  reasoning,
  quantity,
  unitInput,
}: {
  breakdown: { code: string; productName: string; unitFee: number; feeUnit: string; totalFee: number };
  green: { code: string; productName: string; unitFee: number; feeUnit: string; totalFee: number } | null;
  matched: boolean;
  reasoning: string;
  quantity: number;
  unitInput: 'st' | 'kg';
}) {
  const formula = `${quantity.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} ${unitInput} × ${breakdown.unitFee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} ${breakdown.feeUnit}`;
  return (
    <div className="rounded-3xl p-8 sm:p-10 border border-brand-100 shadow-card-lg bg-gradient-to-br from-white via-brand-50/40 to-brand-100/40 relative overflow-hidden">
      {/* decorative blob */}
      <div
        className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-brand-200/30 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-7">
        {/* Top: code + product */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-brand-100 shadow-sm">
              <BadgeCheck size={14} className="text-emerald-600" strokeWidth={2.5} />
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                {matched ? 'Kod matchad' : 'Osäker matchning'}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-700 mb-1">
                El-kretsen produktkod
              </p>
              <p className="text-display text-5xl text-brand-700 leading-none tabular-nums">
                {breakdown.code}
              </p>
            </div>
          </div>
        </div>

        {/* Product name and reasoning */}
        <div>
          <p className="text-[15px] font-bold text-ink-900 leading-snug mb-2">
            {breakdown.productName}
          </p>
          <p className="text-[12.5px] text-ink-600 leading-relaxed">{reasoning}</p>
        </div>

        {/* Formula + total — hero number */}
        <div className="rounded-2xl bg-white border border-ink-100 p-6 shadow-card">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink-500 mb-2">
                Beräkning
              </p>
              <p className="text-[18px] font-bold text-ink-800 tabular-nums leading-tight">
                {formula}
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink-500 mb-1">
                Total avgift (exkl. moms)
              </p>
              <p className="text-display text-6xl text-brand-700 tabular-nums leading-none">
                {breakdown.totalFee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}
                <span className="text-3xl ml-1">kr</span>
              </p>
            </div>
          </div>
        </div>

        {/* Green comparison */}
        {green && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                <Leaf size={11} strokeWidth={2.5} />
                Grön avgift
              </span>
              <span className="text-display text-2xl text-emerald-800 tabular-nums leading-none">
                {green.code}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 ml-auto">
                −10 % vid grön dokumentation
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <p className="text-[12.5px] font-medium text-ink-700 leading-relaxed flex-1 min-w-0">
                Samma produkt med dokumenterade miljö-fördelar kostar{' '}
                <strong className="text-emerald-800">
                  {green.unitFee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} {green.feeUnit}
                </strong>{' '}
                istället.
              </p>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">
                  Total
                </p>
                <p className="text-display text-3xl text-emerald-800 tabular-nums leading-none">
                  {green.totalFee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyHero() {
  return (
    <Card variant="glass" className="p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
      <IconTile icon={<Calculator size={22} strokeWidth={2.25} />} tone="neutral" size="lg" />
      <h3 className="text-display text-3xl text-ink-900 mt-5 mb-2">
        Räkna ut El-kretsen-avgift
      </h3>
      <p className="text-[14px] text-ink-500 max-w-md leading-relaxed">
        Skriv in en produkt och antal/vikt till vänster. AI:n hittar rätt produktkod,
        läser priset från prislistan och räknar ut totalbeloppet direkt.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-md">
        {['B74 batteri', 'Kylskåp', 'Monitor 48 tum'].map((ex) => (
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
    <Card variant="glass" className="p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
      <Spinner size={36} className="text-brand-500 mb-5" />
      <p className="text-display text-xl text-ink-900">Söker rätt produktkod…</p>
      <p className="text-[12px] text-ink-500 mt-2">Matchar mot 149 koder i prislistan</p>
    </Card>
  );
}

function ErrorHero({ message }: { message: string }) {
  return (
    <Card variant="glass" className="p-10 min-h-[360px] flex flex-col items-center justify-center text-center">
      <IconTile icon={<TriangleAlert size={18} strokeWidth={2.25} />} tone="danger" size="lg" />
      <h3 className="text-display text-2xl text-ink-900 mt-5 mb-2">Kunde inte räkna</h3>
      <p className="text-[13px] text-red-700 max-w-md font-medium leading-relaxed">{message}</p>
    </Card>
  );
}
