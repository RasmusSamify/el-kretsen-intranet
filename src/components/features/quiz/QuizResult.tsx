import { Trophy, RefreshCw, Medal } from 'lucide-react';
import { Button, Card, IconTile } from '@/components/ui';

interface QuizResultProps {
  player: string;
  score: number;
  onLeaderboard: () => void;
  onPlayAgain: () => void;
}

export function QuizResult({ player, score, onLeaderboard, onPlayAgain }: QuizResultProps) {
  return (
    <div className="flex flex-col items-center py-12 animate-slide-up">
      <Card variant="glass" className="p-8 w-full max-w-md text-center">
        <IconTile
          icon={<Trophy size={28} strokeWidth={2.25} />}
          tone="gold"
          size="lg"
          className="mx-auto mb-5"
        />
        <h2 className="text-display text-3xl text-ink-900">Snyggt jobbat, {player || 'du'}!</h2>

        <div className="my-8 p-7 rounded-3xl bg-white border border-ink-100 shadow-inner-soft">
          <div className="text-eyebrow">Din slutpoäng</div>
          <div className="text-display text-6xl text-brand-600 mt-2 tabular-nums">
            {score.toLocaleString()}
          </div>
        </div>

        <div className="space-y-2">
          <Button
            fullWidth
            size="lg"
            leftIcon={<Medal size={18} strokeWidth={2.25} />}
            onClick={onLeaderboard}
          >
            Se var du hamnade
          </Button>
          <Button
            fullWidth
            variant="ghost"
            leftIcon={<RefreshCw size={16} strokeWidth={2.25} />}
            onClick={onPlayAgain}
          >
            Spela igen
          </Button>
        </div>
      </Card>
    </div>
  );
}
