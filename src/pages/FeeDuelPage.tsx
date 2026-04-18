import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Flame,
  Medal,
  RefreshCw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  PRICELIST,
  randomPair,
  streakMultiplier,
  type PricedProduct,
} from '@/components/features/duel/pricelist-data';

type Screen = 'intro' | 'play' | 'over';

interface RoundResult {
  correct: boolean;
  pointsGained: number;
  streakAt: number;
}

const ROUNDS_PER_GAME = 10;
const BASE_POINTS = 100;

export function FeeDuelPage() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [pair, setPair] = useState<[PricedProduct, PricedProduct]>(() => randomPair());
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const higherIndex = pair[0].fee > pair[1].fee ? 0 : 1;
  const revealed = picked !== null;
  const lastResult = history[history.length - 1];

  const startGame = () => {
    setScreen('play');
    setScore(0);
    setStreak(0);
    setRoundsPlayed(0);
    setHistory([]);
    setPicked(null);
    setPair(randomPair());
  };

  const pick = (idx: number) => {
    if (revealed) return;
    setPicked(idx);
    const correct = idx === higherIndex;
    const newStreak = correct ? streak + 1 : 0;
    const multiplier = correct ? streakMultiplier(newStreak) : 0;
    const gained = correct ? BASE_POINTS * multiplier : 0;
    setScore((s) => s + gained);
    setStreak(newStreak);
    setHistory((h) => [...h, { correct, pointsGained: gained, streakAt: newStreak }]);
  };

  const nextRound = () => {
    const played = roundsPlayed + 1;
    setRoundsPlayed(played);
    if (played >= ROUNDS_PER_GAME) {
      setScreen('over');
      return;
    }
    setPicked(null);
    setPair(randomPair());
  };

  useEffect(() => {
    if (revealed && screen === 'play') nextBtnRef.current?.focus();
  }, [revealed, screen]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ArrowLeftRight size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Avgifts-duellen</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Vilken produkt har högst avgift? Gissa rätt, bygg streaks, lär dig prislistan
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} strokeWidth={1.75} />
            <span>Interaktivt spel</span>
          </div>
        </header>

        {screen === 'intro' && <IntroScreen onStart={startGame} />}

        {screen === 'play' && (
          <>
            <ScoreBar
              score={score}
              streak={streak}
              round={roundsPlayed + 1}
              totalRounds={ROUNDS_PER_GAME}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 items-stretch">
              <ProductCard
                product={pair[0]}
                revealed={revealed}
                isPicked={picked === 0}
                isWinner={revealed && higherIndex === 0}
                disabled={revealed}
                onClick={() => pick(0)}
              />

              <div className="flex items-center justify-center py-4 lg:py-0">
                <div className="text-display text-4xl text-ink-400 tabular-nums tracking-widest">VS</div>
              </div>

              <ProductCard
                product={pair[1]}
                revealed={revealed}
                isPicked={picked === 1}
                isWinner={revealed && higherIndex === 1}
                disabled={revealed}
                onClick={() => pick(1)}
              />
            </div>

            {revealed && lastResult && (
              <RoundFeedback
                result={lastResult}
                higher={pair[higherIndex]}
                isLastRound={roundsPlayed + 1 >= ROUNDS_PER_GAME}
                nextRef={nextBtnRef}
                onNext={nextRound}
              />
            )}

            {!revealed && (
              <div className="text-center text-[12.5px] font-semibold text-ink-400">
                Klicka på den produkt du tror har högst avgift
              </div>
            )}
          </>
        )}

        {screen === 'over' && (
          <ResultScreen score={score} history={history} onReplay={startGame} />
        )}
      </div>
    </div>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <Card variant="glass" className="p-10 text-center">
      <ArrowLeftRight size={48} strokeWidth={1.25} className="mx-auto mb-5 text-ink-800" />
      <h2 className="text-display text-4xl text-ink-900">Avgifts-duellen</h2>
      <p className="text-ink-500 text-[14px] leading-relaxed mt-3 max-w-xl mx-auto">
        Två produkter från El-kretsens prislista ställs mot varandra. Du gissar vilken
        som har <strong className="text-ink-800">högst avgift per enhet</strong>. Bygg
        streaks — 3 rätt i rad ger dubbla poäng, 5 rätt ger tredubbla.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
        <IntroStat label="Rundor" value={`${ROUNDS_PER_GAME}`} icon={<Trophy size={16} strokeWidth={1.75} />} />
        <IntroStat label="Streak x2" value="3 rätt" icon={<Flame size={16} strokeWidth={1.75} />} />
        <IntroStat label="Streak x4" value="8 rätt" icon={<Sparkles size={16} strokeWidth={1.75} />} />
      </div>

      <Button
        onClick={onStart}
        size="lg"
        className="mt-8"
        rightIcon={<ArrowRight size={18} strokeWidth={1.75} />}
      >
        Starta duellen
      </Button>

      <p className="text-[11px] font-semibold text-ink-400 mt-4">
        {PRICELIST.length} produkter från Prislista 2026 · slumpade par · exkl. moms
      </p>
    </Card>
  );
}

function IntroStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-2xl bg-white border border-ink-100 shadow-sm">
      <div className="flex items-center justify-center gap-1.5 mb-1 text-ink-500">{icon}</div>
      <p className="text-display text-lg text-ink-900 tabular-nums leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">{label}</p>
    </div>
  );
}

function ScoreBar({
  score,
  streak,
  round,
  totalRounds,
}: {
  score: number;
  streak: number;
  round: number;
  totalRounds: number;
}) {
  const pct = ((round - 1) / totalRounds) * 100;
  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Runda</p>
          <p className="text-display text-2xl text-ink-900 tabular-nums">
            {round} <span className="text-ink-300">/ {totalRounds}</span>
          </p>
        </div>

        <div className="flex-1 mx-4 max-w-sm">
          <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-ink-900 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <Flame size={14} strokeWidth={1.75} className="text-amber-600" />
              <span className="text-display text-lg text-amber-800 tabular-nums">{streak}</span>
              {streakMultiplier(streak) > 1 && (
                <span className="text-[10px] font-black text-amber-700 tabular-nums">
                  ×{streakMultiplier(streak)}
                </span>
              )}
            </div>
          )}

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Poäng</p>
            <p className="text-display text-3xl text-ink-900 tabular-nums leading-none">
              {score.toLocaleString('sv-SE')}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProductCard({
  product,
  revealed,
  isPicked,
  isWinner,
  disabled,
  onClick,
}: {
  product: PricedProduct;
  revealed: boolean;
  isPicked: boolean;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const showReveal = revealed;
  const showSuccess = showReveal && isWinner;
  const showFail = showReveal && isPicked && !isWinner;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative text-left rounded-3xl p-7 overflow-hidden',
        'border-2 transition-all duration-300 shadow-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2',
        showSuccess && 'border-emerald-500 bg-emerald-50/70 -translate-y-[2px] shadow-card-lg',
        showFail && 'border-red-400 bg-red-50/60 opacity-90',
        !showReveal && 'border-ink-200 bg-white hover:border-ink-900 hover:-translate-y-[2px] hover:shadow-card-lg cursor-pointer',
        showReveal && !isPicked && !isWinner && 'border-ink-200 bg-white opacity-60',
      )}
      aria-label={`Välj ${product.name}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-ink-900 text-white text-[11px] font-black tracking-wider">
          {product.code}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {product.category}
        </span>
      </div>

      <h3 className="text-display text-2xl sm:text-3xl text-ink-900 leading-tight min-h-[72px]">
        {product.name}
      </h3>

      <div className="mt-6 pt-5 border-t border-ink-100 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Avgift</p>
          <div className="mt-1 min-h-[52px] flex items-end">
            {showReveal ? (
              <p
                className={cn(
                  'text-display tabular-nums leading-none transition-all duration-500 ease-out',
                  showSuccess ? 'text-emerald-700 text-5xl' : 'text-ink-800 text-4xl',
                )}
                style={{ animation: 'slideUp 0.4s ease-out' }}
              >
                {product.fee.toLocaleString('sv-SE', {
                  maximumFractionDigits: 2,
                })}
                <span className="text-xl ml-1 text-ink-400">{product.unit}</span>
              </p>
            ) : (
              <div className="flex gap-1.5 text-ink-300">
                <span className="w-3 h-3 rounded-full bg-ink-200" />
                <span className="w-3 h-3 rounded-full bg-ink-200" />
                <span className="w-3 h-3 rounded-full bg-ink-200" />
              </div>
            )}
          </div>
        </div>

        <div className={cn('transition-all duration-300', showReveal ? 'opacity-100' : 'opacity-0')}>
          {showSuccess && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
              <Check size={12} strokeWidth={2.5} />
              Rätt
            </span>
          )}
          {showFail && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-black uppercase tracking-wider">
              <X size={12} strokeWidth={2.5} />
              Fel
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function RoundFeedback({
  result,
  higher,
  isLastRound,
  nextRef,
  onNext,
}: {
  result: RoundResult;
  higher: PricedProduct;
  isLastRound: boolean;
  nextRef: React.RefObject<HTMLButtonElement>;
  onNext: () => void;
}) {
  return (
    <Card
      variant="glass"
      className={cn(
        'p-5 border-2',
        result.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/30',
      )}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div
          className={cn(
            'w-11 h-11 rounded-xl inline-flex items-center justify-center shrink-0',
            result.correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white',
          )}
        >
          {result.correct ? <Check size={20} strokeWidth={2.5} /> : <X size={20} strokeWidth={2.5} />}
        </div>
        <div className="flex-1 min-w-[220px]">
          <p
            className={cn(
              'text-display text-xl leading-none',
              result.correct ? 'text-emerald-800' : 'text-red-800',
            )}
          >
            {result.correct ? `+${result.pointsGained} poäng` : 'Tyvärr fel!'}
          </p>
          <p className="text-[12.5px] text-ink-700 mt-1">
            <strong className="text-ink-900">{higher.code}</strong> — {higher.name} har avgiften{' '}
            <strong className="text-ink-900 tabular-nums">
              {higher.fee.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} {higher.unit}
            </strong>
          </p>
        </div>
        <Button
          ref={nextRef}
          onClick={onNext}
          size="lg"
          rightIcon={<ArrowRight size={16} strokeWidth={2} />}
        >
          {isLastRound ? 'Se slutresultat' : 'Nästa runda'}
        </Button>
      </div>
    </Card>
  );
}

function ResultScreen({
  score,
  history,
  onReplay,
}: {
  score: number;
  history: RoundResult[];
  onReplay: () => void;
}) {
  const correct = history.filter((r) => r.correct).length;
  const longestStreak = history.reduce((max, r) => Math.max(max, r.streakAt), 0);
  const rating = score >= 2400 ? 'Prislistemästare' : score >= 1200 ? 'Rutinerad' : score >= 600 ? 'Lovande' : 'Ny på jobbet';

  return (
    <div className="max-w-xl mx-auto">
      <Card variant="glass" className="p-10 text-center">
        <Trophy size={48} strokeWidth={1.25} className="mx-auto mb-4 text-ink-800" />
        <h2 className="text-display text-3xl text-ink-900">{rating}!</h2>
        <p className="text-ink-500 font-medium mt-1">Du avslutade alla {history.length} rundor</p>

        <div className="my-8 p-8 rounded-3xl bg-white border border-ink-100 shadow-inner-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Slutpoäng</p>
          <p className="text-display text-7xl text-ink-900 tabular-nums leading-none mt-2">
            {score.toLocaleString('sv-SE')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-7">
          <SmallStat icon={<Check size={14} />} label="Rätt" value={`${correct} / ${history.length}`} />
          <SmallStat icon={<Flame size={14} />} label="Längsta streak" value={`${longestStreak}`} />
          <SmallStat
            icon={<Medal size={14} />}
            label="Träffsäkerhet"
            value={`${Math.round((correct / Math.max(1, history.length)) * 100)}%`}
          />
        </div>

        <Button
          onClick={onReplay}
          fullWidth
          size="lg"
          leftIcon={<RefreshCw size={16} strokeWidth={1.75} />}
        >
          Spela igen
        </Button>
      </Card>
    </div>
  );
}

function SmallStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-ink-100">
      <div className="flex items-center justify-center gap-1 mb-1 text-ink-500">{icon}</div>
      <p className="text-display text-lg text-ink-900 tabular-nums leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">{label}</p>
    </div>
  );
}
