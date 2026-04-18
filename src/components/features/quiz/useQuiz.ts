import { useState } from 'react';
import { QUIZ_KNOWLEDGE_URL, QUIZ_GENERATOR_URL, CATEGORIES, type Question } from './constants';

async function getKnowledgeBase(): Promise<string> {
  const res = await fetch(QUIZ_KNOWLEDGE_URL);
  return res.text();
}

async function generateQuestions(categoryId: string, count: number): Promise<Question[]> {
  const kb = await getKnowledgeBase();
  const seed = Date.now();
  const catLabel = categoryId === 'all' ? 'alla kategorier' : CATEGORIES.find((c) => c.id === categoryId)?.label;
  const prompt = `SESSION: ${seed}. Skapa ${count} flervalsfrågor på SVENSKA om: ${catLabel}. Plocka frågor från HELA dokumentet, sprid ut dem! Kunskapsbas: ${kb}. Svara i JSON: { "questions": [ { "question": "Text?", "answers": ["A","B","C","D"], "correct": 0, "explanation": "Varför?" } ] }`;

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(QUIZ_GENERATOR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim()).questions as Question[];
}

export type QuizScreen = 'home' | 'loading' | 'quiz' | 'result' | 'leaderboard';

export function useQuiz() {
  const [screen, setScreen] = useState<QuizScreen>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [player, setPlayer] = useState('');
  const [category, setCategory] = useState('all');
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const start = async (name: string, categoryId: string, count: number) => {
    setPlayer(name);
    setCategory(categoryId);
    setScreen('loading');
    setError(null);
    try {
      const qs = await generateQuestions(categoryId, count);
      setQuestions(qs);
      setScreen('quiz');
    } catch (e) {
      setError((e as Error).message);
      setScreen('home');
    }
  };

  return {
    screen,
    setScreen,
    questions,
    player,
    category,
    setCategory,
    score,
    setScore,
    error,
    start,
  };
}
