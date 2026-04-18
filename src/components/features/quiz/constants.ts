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

export const QUIZ_KNOWLEDGE_URL =
  'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Quiz%20dokument/Elkretsen_Kunskapsbas_Samlad_Quiz.txt?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJRdWl6IGRva3VtZW50L0Vsa3JldHNlbl9LdW5za2Fwc2Jhc19TYW1sYWRfUXVpei50eHQiLCJpYXQiOjE3NzI2NTI2NzYsImV4cCI6NDkyNjI1MjY3Nn0.3zkcFjaJmwLPFEoWa9sJx15eq2xil9NiteRPb76mtKQ';

export const QUIZ_GENERATOR_URL =
  'https://jnwatbnkdzuyhqmcerej.supabase.co/functions/v1/smooth-action';

export interface Question {
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
}

export function calcScore(timeLeft: number, correct: boolean): number {
  return correct ? Math.round(500 + (timeLeft / TIME_PER_QUESTION) * 500) : 0;
}
