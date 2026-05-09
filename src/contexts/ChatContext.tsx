import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { aiSearch } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function logQuestion(questionText: string) {
  const normalized = questionText.trim().toLowerCase().slice(0, 200);
  if (!normalized) return;

  const { data: existing } = await supabase
    .from('ai_questions')
    .select('id, count')
    .ilike('question_text', normalized)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from('ai_questions')
      .update({ count: existing[0].count + 1, last_asked: new Date().toISOString() })
      .eq('id', existing[0].id);
  } else {
    await supabase.from('ai_questions').insert([{ question_text: normalized, count: 1 }]);
  }
}

export interface ChatContextValue {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  send: (text: string, attachedFileContent?: string | null) => Promise<void>;
  clear: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defense-in-depth: if the authenticated user id changes (e.g. signout/signin
  // happens without the provider unmounting), wipe history so one person never
  // sees the previous person's chat. Provider also unmounts on signout via
  // ProtectedRoute, which gives us the primary reset path.
  useEffect(() => {
    setMessages([]);
    setError(null);
    setStreaming(false);
  }, [user?.id]);

  const send = useCallback(
    async (text: string, attachedFileContent?: string | null) => {
      if (!text.trim() || streaming) return;
      setError(null);
      setStreaming(true);

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const history = [...messages, userMessage];
      setMessages(history);

      logQuestion(text).catch(() => {});

      try {
        const res = await aiSearch({
          query: text,
          conversationHistory: history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          attachedFileContent: attachedFileContent ?? undefined,
        });

        const assistantMessage: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          content: res.answer,
          citations: res.citations,
          sourceFiles: res.sourceFiles,
          grounded: res.grounded,
          timestamp: Date.now(),
        };

        setMessages((curr) => [...curr, assistantMessage]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Okänt fel';
        setError(msg);
        setMessages((curr) => [
          ...curr,
          {
            id: makeId(),
            role: 'assistant',
            content: `Ett fel inträffade: ${msg}. Försök igen om en stund.`,
            timestamp: Date.now(),
            grounded: false,
          },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, streaming, error, send, clear }}>
      {children}
    </ChatContext.Provider>
  );
}
