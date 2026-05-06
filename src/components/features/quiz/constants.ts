import { Zap, Landmark, Coins, Wrench, Scale, type LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'Alla kategorier', icon: Zap },
  { id: 'C', label: 'EU & Reglering', icon: Landmark },
  { id: 'A', label: 'Ekonomi', icon: Coins },
  { id: 'B', label: 'Teknik', icon: Wrench },
  { id: 'D', label: 'Juridik', icon: Scale },
];

export const TIME_PER_QUESTION = 20;
export const QUESTIONS_PER_ROUND = 10;

export const QUIZ_GENERATOR_URL = '/api/quiz-generator';

export interface Question {
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
}

export function calcScore(timeLeft: number, correct: boolean): number {
  return correct ? Math.round(500 + (timeLeft / TIME_PER_QUESTION) * 500) : 0;
}
