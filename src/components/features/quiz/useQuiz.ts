import { useState } from 'react';
import { QUIZ_GENERATOR_URL, type Question } from './constants';

async function generateQuestions(categoryId: string, count: number): Promise<Question[]> {
  const res = await fetch(QUIZ_GENERATOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, count }),
  });

  // Läs som text först — vid timeout/serverfel kan svaret vara en HTML-sida,
  // inte JSON. Då vill vi visa ett begripligt meddelande, inte "Unexpected token".
  const raw = await res.text();
  let data: { questions?: Question[]; error?: { message?: string } } | null = null;
  try {
    data = JSON.parse(raw);
  } catch {
    if (res.status === 504 || res.status === 408) {
      throw new Error('Det tog för lång tid att skapa frågorna. Försök igen om en stund.');
    }
    throw new Error(`Kunde inte skapa frågor (fel ${res.status}). Försök igen.`);
  }

  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message ?? `Quiz-generator ${res.status}`);
  }
  return (data?.questions ?? []) as Question[];
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
