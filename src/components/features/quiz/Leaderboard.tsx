import { useEffect, useState } from 'react';
import { ArrowLeft, Medal, Zap } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatDate, cn } from '@/lib/utils';
import { CATEGORIES } from './constants';

interface ScoreRow {
  id: number;
  name: string;
  score: number;
  correct: number;
  total: number;
  category: string;
  played_at: string;
}

interface LeaderboardProps {
  onBack: () => void;
  highlightPlayer: string;
  highlightScore: number;
}

export function Leaderboard({ onBack, highlightPlayer, highlightScore }: LeaderboardProps) {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('kretskampen_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows((data as ScoreRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex justify-center px-4 py-8 animate-fade-in">
      <Card variant="glass" className="w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: 850 }}>
        <div
          className="relative px-6 py-8 text-white text-center shadow-lg"
          style={{ background: 'var(--brand-gradient)' }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="!absolute left-5 top-1/2 -translate-y-1/2 !text-white/90 hover:!text-white !bg-black/15 hover:!bg-black/25"
            onClick={onBack}
            leftIcon={<ArrowLeft size={14} strokeWidth={2.25} />}
          >
            Tillbaka
          </Button>
          <h2 className="text-display text-4xl sm:text-5xl text-white uppercase tracking-wide">Topplistan</h2>
          <p className="text-xs sm:text-sm font-bold tracking-[0.16em] uppercase opacity-80 mt-2">
            Topp 50 hos El-kretsen
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-2.5">
          {loading ? (
            <div className="text-center py-20 text-ink-500 font-semibold">
              <Spinner size={22} className="text-brand-500 mb-3" />
              <div>Laddar resultat…</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-20 text-ink-400 font-semibold">Inga resultat ännu.</div>
          ) : (
            rows.map((s, i) => {
              const isMe = s.name === highlightPlayer && s.score === highlightScore && highlightScore > 0;
              const CatIcon = CATEGORIES.find((c) => c.id === s.category)?.icon ?? Zap;
              const rankTone =
                i === 0 ? 'bg-amber-50 border-amber-200' :
                i === 1 ? 'bg-ink-100 border-ink-300' :
                i === 2 ? 'bg-orange-50 border-orange-200' :
                'bg-white border-ink-100';

              return (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm transition-all',
                    rankTone,
                    isMe && '!border-brand-400 !border-2 shadow-md scale-[1.01]',
                  )}
                >
                  <div
                    className="text-display text-2xl w-10 text-center shrink-0 tabular-nums"
                    style={{
                      color:
                        i === 0 ? '#D97706' :
                        i === 1 ? '#64748B' :
                        i === 2 ? '#C2410C' :
                        '#94A3B8',
                    }}
                  >
                    {i < 3 ? <Medal size={22} strokeWidth={2.25} className="mx-auto" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 font-bold text-ink-900 text-[15px] truncate">
                      {s.name}
                      {isMe && (
                        <span className="hidden sm:inline-block text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shadow-sm bg-brand-500">
                          Du
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 uppercase tracking-wider mt-0.5">
                      <CatIcon size={11} strokeWidth={2.25} />
                      <span>{s.correct}/{s.total} rätt</span>
                      <span className="opacity-40">·</span>
                      <span>{formatDate(s.played_at)}</span>
                    </div>
                  </div>
                  <div className="text-display text-2xl text-brand-600 shrink-0 tabular-nums">
                    {s.score.toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
