import { Rocket, Trophy, AlertCircle } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { CATEGORIES, QUESTIONS_PER_ROUND } from './constants';

interface QuizHomeProps {
  player: string;
  category: string;
  error: string | null;
  onPlayerChange: (name: string) => void;
  onCategoryChange: (id: string) => void;
  onStart: () => void;
  onLeaderboard: () => void;
}

export function QuizHome({
  player,
  category,
  error,
  onPlayerChange,
  onCategoryChange,
  onStart,
  onLeaderboard,
}: QuizHomeProps) {
  return (
    <div className="flex flex-col items-center py-10 px-4 animate-slide-up">
      <Card variant="glass" className="p-8 w-full max-w-md">
        <div className="text-center mb-7">
          <Trophy size={38} strokeWidth={1.5} className="mx-auto mb-3 text-ink-800" />
          <h2 className="text-display text-5xl text-ink-900">Kretskampen</h2>
          <p className="text-ink-500 font-medium mt-2">Utmana kollegorna i El-kretsens kunskapskamp</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-eyebrow block mb-2">Ditt namn</label>
            <Input
              value={player}
              onChange={(e) => onPlayerChange(e.target.value)}
              placeholder="T.ex. Linnea…"
              maxLength={20}
            />
          </div>

          <div>
            <label className="text-eyebrow block mb-2">Kategori</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map(({ id, label, icon: Icon }) => {
                const selected = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCategoryChange(id)}
                    className={cn(
                      'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-[14px] font-semibold transition-all border-2',
                      selected
                        ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                        : 'bg-white text-ink-700 border-ink-200 hover:border-brand-400 hover:text-brand-600',
                    )}
                  >
                    <Icon size={16} strokeWidth={2.25} />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" strokeWidth={2.25} />
              <p className="text-[13px] font-semibold text-red-700">{error}</p>
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            disabled={!player.trim()}
            onClick={onStart}
            rightIcon={<Rocket size={18} strokeWidth={2.25} />}
          >
            Starta kampen · {QUESTIONS_PER_ROUND} frågor
          </Button>
          <Button
            fullWidth
            variant="ghost"
            size="md"
            leftIcon={<Trophy size={16} strokeWidth={2.25} />}
            onClick={onLeaderboard}
          >
            Visa Highscore
          </Button>
        </div>
      </Card>
    </div>
  );
}
