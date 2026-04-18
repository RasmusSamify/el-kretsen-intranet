import { useCallback, useState } from 'react';
import { aiSearch } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';
import { supabase } from '@/lib/supabase';

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

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { messages, streaming, error, send, clear };
}
