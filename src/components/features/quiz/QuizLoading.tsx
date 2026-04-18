import { TypingDots, Card } from '@/components/ui';

export function QuizLoading({ player }: { player: string }) {
  return (
    <div className="flex items-center justify-center py-20 animate-fade-in">
      <Card variant="glass" className="p-10 text-center max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <TypingDots />
        </div>
        <p className="text-display text-xl text-brand-600 uppercase tracking-[0.12em]">AI laddar frågor…</p>
        <p className="text-ink-500 font-medium text-sm mt-2">Letar upp kluriga utmaningar åt {player || 'dig'}</p>
      </Card>
    </div>
  );
}
