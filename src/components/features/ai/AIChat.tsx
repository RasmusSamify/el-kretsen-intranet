import { useCallback, useEffect, useRef } from 'react';
import { AlignLeft, Eraser, Sparkles, Zap } from 'lucide-react';
import { Card, Button, IconTile, TypingDots } from '@/components/ui';
import { CURRENT_VERSION } from '@/lib/version';
import { useAIChat } from '@/hooks/useAIChat';
import { cn } from '@/lib/utils';
import { Message } from './Message';
import { Composer } from './Composer';
import { WelcomeState } from './WelcomeState';
import { SidePanel } from './SidePanel';
import { FollowUpChips } from './FollowUpChips';

export function AIChat() {
  const { messages, streaming, answerMode, setAnswerMode, send, clear } = useAIChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const lastMessage = messages[messages.length - 1];
  const waitingForFirstToken = streaming && (!lastMessage || lastMessage.role === 'user');

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const handleSend = useCallback(
    (text: string, attached: string | null) => {
      send(text, attached);
    },
    [send],
  );

  const handleQuickPrompt = (prompt: string) => {
    pendingPromptRef.current = prompt;
    send(prompt);
  };

  return (
    <>
      <Card variant="glass" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-3">
          <IconTile tone="brand" size="md" icon={<Sparkles size={16} strokeWidth={1.75} />} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-ink-900 text-[15px] leading-none">ELvis</h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-brand-500 to-violet-500 text-white text-[9px] font-bold uppercase tracking-wider leading-none">
                v{CURRENT_VERSION.split('.').slice(0, 2).join('.')}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-ink-400 mt-1">
              Tvåstegs hierarkisk sök · Förslag på följdfrågor · Källhänvisningar · Rättelser
            </p>
          </div>
          <AnswerModeToggle mode={answerMode} onChange={setAnswerMode} disabled={streaming} />
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Eraser size={14} strokeWidth={2.25} />}
              onClick={clear}
              disabled={streaming}
            >
              Rensa
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <WelcomeState onPick={handleQuickPrompt} />
          ) : (
            <>
              {messages.map((m, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                const question = m.role === 'assistant' && prev?.role === 'user' ? prev.content : undefined;
                const isLast = i === messages.length - 1;
                return (
                  <Message
                    key={m.id}
                    message={m}
                    question={question}
                    isStreaming={streaming && isLast && m.role === 'assistant'}
                  />
                );
              })}
              {waitingForFirstToken && (
                <div className="flex gap-3 animate-fade-in">
                  <IconTile size="sm" tone="brand" icon={<Sparkles size={14} strokeWidth={2.25} />} />
                  <div className="px-5 py-4 rounded-2xl rounded-bl-md bg-white border border-ink-100 shadow-card">
                    <TypingDots />
                  </div>
                </div>
              )}
              {!streaming && (() => {
                const last = messages[messages.length - 1];
                if (!last || last.role !== 'assistant') return null;
                const chips = last.suggestedFollowUps ?? [];
                if (chips.length === 0) return null;
                return <FollowUpChips chips={chips} disabled={streaming} onPick={(t) => send(t)} />;
              })()}
            </>
          )}
        </div>

        <Composer onSend={handleSend} disabled={streaming} />
      </Card>

      <SidePanel onPickPrompt={handleQuickPrompt} />
    </>
  );
}

function AnswerModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: 'stream' | 'wait';
  onChange: (mode: 'stream' | 'wait') => void;
  disabled?: boolean;
}) {
  const options = [
    { id: 'stream' as const, label: 'Direkt', icon: Zap, title: 'Se ELvis skriva svaret rad för rad' },
    { id: 'wait' as const, label: 'Hela', icon: AlignLeft, title: 'Vänta tills hela svaret är klart' },
  ];
  return (
    <div
      role="group"
      aria-label="Svarsvisning"
      className="hidden sm:inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-ink-100/70 border border-ink-100"
    >
      {options.map(({ id, label, icon: Icon, title }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            title={title}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              active ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            <Icon size={12} strokeWidth={2.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
