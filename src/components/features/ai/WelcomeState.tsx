import { Sparkles } from 'lucide-react';
import { IconTile } from '@/components/ui';

const QUICK_PROMPTS = [
  'Vad är producentansvar för batterier?',
  'När tas samlingskoden B77 bort?',
  'Vilka insamlingsmål gäller för bärbara batterier?',
  'Vad säger WEEE-direktivet?',
];

export function WelcomeState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 animate-fade-in">
      <IconTile icon={<Sparkles size={22} strokeWidth={2.25} />} tone="brand" size="lg" />
      <h3 className="text-display text-2xl text-ink-900 mt-5 mb-2">Hej! Vad kan jag hjälpa till med?</h3>
      <p className="text-ink-500 text-sm max-w-md leading-relaxed">
        Ställ en fråga om producentansvar, batterikoder, avgifter eller avfallsregler.
        Varje svar backas upp med källhänvisningar.
      </p>
      <div className="mt-7 flex flex-wrap gap-2 justify-center max-w-lg">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPick(prompt)}
            className="text-[13px] font-semibold px-4 py-2 rounded-full bg-white border border-ink-200 text-ink-700 transition-all duration-200 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 hover:-translate-y-[1px] shadow-sm"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
