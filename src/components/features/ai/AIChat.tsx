import { useCallback, useEffect, useRef } from 'react';
import { Eraser, Sparkles } from 'lucide-react';
import { Card, Button, IconTile, TypingDots } from '@/components/ui';
import { useAIChat } from '@/hooks/useAIChat';
import { Message } from './Message';
import { Composer } from './Composer';
import { WelcomeState } from './WelcomeState';
import { SidePanel } from './SidePanel';

export function AIChat() {
  const { messages, streaming, send, clear } = useAIChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingPromptRef = useRef<string | null>(null);

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
          <IconTile size="md" tone="brand" icon={<Sparkles size={16} strokeWidth={2.25} />} />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-ink-900 text-[15px] leading-none">AI-analys</h2>
            <p className="text-[11px] font-semibold text-ink-400 mt-1">
              Grundad i El-kretsens kunskapsbank · Temperature 0 · Källhänvisningar
            </p>
          </div>
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
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
              {streaming && (
                <div className="flex gap-3 animate-fade-in">
                  <IconTile size="sm" tone="brand" icon={<Sparkles size={14} strokeWidth={2.25} />} />
                  <div className="px-5 py-4 rounded-2xl rounded-bl-md bg-white border border-ink-100 shadow-card">
                    <TypingDots />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <Composer onSend={handleSend} disabled={streaming} />
      </Card>

      <SidePanel onPickPrompt={handleQuickPrompt} />
    </>
  );
}
