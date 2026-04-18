import { useEffect, useRef, useState } from 'react';
import { Check, X, Clock, ArrowRight, Trophy } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { TimerRing } from './TimerRing';
import { calcScore, TIME_PER_QUESTION, type Question } from './constants';

interface HistoryEntry {
  gained: number;
  correct: boolean;
  timeLeft: number;
}

interface QuizRoundProps {
  questions: Question[];
  player: string;
  onFinish: (score: number, history: HistoryEntry[]) => void;
}

export function QuizRound({ questions, player, onFinish }: QuizRoundProps) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const q = questions[idx];

  const answer = (i: number) => {
    if (selected !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(i);
    const correct = i === q.correct;
    const gained = calcScore(timeLeft, correct);
    setScore((s) => s + gained);
    setHistory((h) => [...h, { gained, correct, timeLeft }]);
  };

  useEffect(() => {
    setSelected(null);
    setTimeLeft(TIME_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setSelected(-1);
          setHistory((h) => [...h, { gained: 0, correct: false, timeLeft: 0 }]);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const isLast = idx === questions.length - 1;
  const lastEntry = history[history.length - 1];
  const isTimeout = selected === -1;

  const next = () => {
    if (isLast) {
      onFinish(score, history);
    } else {
      setIdx((i) => i + 1);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card variant="glass" className="overflow-hidden">
        <div className="bg-white/95 px-5 py-4 border-b border-ink-100 flex justify-between items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
              Fråga {idx + 1} / {questions.length}
            </div>
            <div className="text-display text-xl text-ink-900 mt-0.5">{player}</div>
          </div>
          <TimerRing timeLeft={timeLeft} total={TIME_PER_QUESTION} />
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Poäng</div>
            <div className="text-display text-3xl text-ink-900 mt-0.5 tabular-nums">{score.toLocaleString()}</div>
          </div>
        </div>

        <div className="p-6 sm:p-8 bg-ink-50/40">
          <h3 className="text-xl sm:text-2xl font-bold mb-7 text-center leading-relaxed text-ink-900">
            {q.question}
          </h3>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {q.answers.map((a, i) => {
              let state = 'default';
              if (selected !== null) {
                if (i === q.correct) state = 'correct';
                else if (i === selected) state = 'wrong';
                else state = 'dim';
              }
              return (
                <button
                  key={i}
                  disabled={selected !== null}
                  onClick={() => answer(i)}
                  className={cn(
                    'text-left p-5 rounded-2xl transition-all duration-300 shadow-sm border-2 font-semibold text-[15px] leading-snug',
                    state === 'default' && 'bg-white border-ink-200 text-ink-800 hover:border-brand-400 hover:-translate-y-[1px] hover:shadow-md',
                    state === 'correct' && 'bg-emerald-600 border-emerald-700 text-white scale-[1.01] shadow-lg',
                    state === 'wrong' && 'bg-red-600 border-red-700 text-white opacity-95',
                    state === 'dim' && 'bg-white border-ink-100 text-ink-400 opacity-60',
                  )}
                >
                  <span className="inline-flex items-center gap-3 w-full">
                    <span
                      className={cn(
                        'w-8 h-8 rounded-lg inline-flex items-center justify-center text-xs font-black tabular-nums shrink-0',
                        state === 'default' && 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
                        state === 'correct' && 'bg-white/20 text-white',
                        state === 'wrong' && 'bg-white/20 text-white',
                        state === 'dim' && 'bg-ink-100 text-ink-400',
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{a}</span>
                    {state === 'correct' && <Check size={18} strokeWidth={3} />}
                    {state === 'wrong' && <X size={18} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div
              className={cn(
                'animate-slide-up rounded-2xl border-l-4 overflow-hidden shadow-md bg-white',
                selected === q.correct ? 'border-emerald-500' : 'border-red-500',
              )}
            >
              <div className={cn('p-5', selected === q.correct ? 'bg-emerald-50/70' : 'bg-red-50/70')}>
                <div className="flex justify-between items-center mb-2">
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 font-bold text-base',
                      selected === q.correct ? 'text-emerald-700' : 'text-red-700',
                    )}
                  >
                    {selected === q.correct ? (
                      <>
                        <Check size={18} strokeWidth={2.75} />
                        Rätt svar!
                      </>
                    ) : isTimeout ? (
                      <>
                        <Clock size={18} strokeWidth={2.75} />
                        Tiden gick ut
                      </>
                    ) : (
                      <>
                        <X size={18} strokeWidth={2.75} />
                        Tyvärr fel
                      </>
                    )}
                  </div>
                  {selected === q.correct && lastEntry && (
                    <div className="font-black text-emerald-900 bg-emerald-200 px-3 py-1.5 rounded-full text-sm tabular-nums">
                      +{lastEntry.gained} p
                    </div>
                  )}
                </div>
                <div className="text-ink-800 leading-relaxed text-[14px]">{q.explanation}</div>
              </div>

              <div className="p-4 bg-white border-t border-ink-100">
                <Button
                  fullWidth
                  onClick={next}
                  rightIcon={isLast ? <Trophy size={18} strokeWidth={2.25} /> : <ArrowRight size={18} strokeWidth={2.25} />}
                >
                  {isLast ? 'Se resultat' : 'Nästa fråga'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
