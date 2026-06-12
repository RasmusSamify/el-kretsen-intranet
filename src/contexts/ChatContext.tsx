import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { aiSearch, aiSearchStream } from '@/lib/api';
import type { ChatMessage } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

/** Vy #2 (stream) = se ELvis skriva rad för rad. Vy #1 (wait) = hela svaret på en gång. */
export type AnswerMode = 'stream' | 'wait';
const ANSWER_MODE_KEY = 'elvis_answer_mode';

function loadAnswerMode(): AnswerMode {
  if (typeof localStorage === 'undefined') return 'stream';
  return localStorage.getItem(ANSWER_MODE_KEY) === 'wait' ? 'wait' : 'stream';
}

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
  answerMode: AnswerMode;
  setAnswerMode: (mode: AnswerMode) => void;
  send: (text: string, attachedFileContent?: string | null) => Promise<void>;
  clear: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerMode, setAnswerModeState] = useState<AnswerMode>(loadAnswerMode);

  const setAnswerMode = useCallback((mode: AnswerMode) => {
    setAnswerModeState(mode);
    if (typeof localStorage !== 'undefined') localStorage.setItem(ANSWER_MODE_KEY, mode);
  }, []);

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

      const request = {
        query: text,
        conversationHistory: history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        attachedFileContent: attachedFileContent ?? undefined,
      };

      // I stream-läget skapas inget tomt placeholder-meddelande direkt — vi visar
      // skrivprickar (sista meddelandet = användarens) tills första token landar,
      // sedan dyker assistent-bubblan upp och växer. assistantId binder ihop deltas.
      let assistantId: string | null = null;

      try {
        if (answerMode === 'stream') {
          assistantId = makeId();
          const id = assistantId;
          await aiSearchStream(request, {
            onDelta: (chunk) =>
              setMessages((curr) => {
                if (curr.some((m) => m.id === id)) {
                  return curr.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m));
                }
                return [...curr, { id, role: 'assistant', content: chunk, timestamp: Date.now() }];
              }),
            onDone: (meta) =>
              setMessages((curr) => {
                const finalize = (m: ChatMessage): ChatMessage => ({
                  ...m,
                  content: meta.answer,
                  citations: meta.citations,
                  sourceFiles: meta.sourceFiles,
                  grounded: meta.grounded,
                  suggestedFollowUps: meta.suggestedFollowUps,
                });
                if (curr.some((m) => m.id === id)) return curr.map((m) => (m.id === id ? finalize(m) : m));
                return [...curr, finalize({ id, role: 'assistant', content: '', timestamp: Date.now() })];
              }),
          });
        } else {
          const res = await aiSearch(request);
          setMessages((curr) => [
            ...curr,
            {
              id: makeId(),
              role: 'assistant',
              content: res.answer,
              citations: res.citations,
              sourceFiles: res.sourceFiles,
              grounded: res.grounded,
              suggestedFollowUps: res.suggestedFollowUps,
              timestamp: Date.now(),
            },
          ]);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Okänt fel';
        setError(msg);
        const errText = `Ett fel inträffade: ${msg}. Försök igen om en stund.`;
        const id = assistantId;
        setMessages((curr) => {
          // Om en streamad bubbla redan började — ersätt den med felet i stället för dubblett.
          if (id && curr.some((m) => m.id === id)) {
            return curr.map((m) => (m.id === id ? { ...m, content: errText, grounded: false } : m));
          }
          return [
            ...curr,
            { id: makeId(), role: 'assistant', content: errText, timestamp: Date.now(), grounded: false },
          ];
        });
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming, answerMode],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, streaming, error, answerMode, setAnswerMode, send, clear }}>
      {children}
    </ChatContext.Provider>
  );
}
