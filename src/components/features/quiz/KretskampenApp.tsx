import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuiz } from './useQuiz';
import { QuizHome } from './QuizHome';
import { QuizLoading } from './QuizLoading';
import { QuizRound } from './QuizRound';
import { QuizResult } from './QuizResult';
import { Leaderboard } from './Leaderboard';
import { QUESTIONS_PER_ROUND } from './constants';

export function KretskampenApp() {
  const quiz = useQuiz();
  const [playerInput, setPlayerInput] = useState('');

  const start = () => {
    quiz.start(playerInput, quiz.category, QUESTIONS_PER_ROUND);
  };

  const finish = async (finalScore: number, history: Array<{ correct: boolean }>) => {
    quiz.setScore(finalScore);
    quiz.setScreen('result');
    const correctCount = history.filter((h) => h.correct).length;
    await supabase.from('kretskampen_scores').insert([
      {
        name: quiz.player,
        score: finalScore,
        correct: correctCount,
        total: quiz.questions.length,
        category: quiz.category,
        played_at: new Date().toISOString(),
      },
    ]);
  };

  switch (quiz.screen) {
    case 'home':
      return (
        <QuizHome
          player={playerInput}
          category={quiz.category}
          error={quiz.error}
          onPlayerChange={setPlayerInput}
          onCategoryChange={quiz.setCategory}
          onStart={start}
          onLeaderboard={() => quiz.setScreen('leaderboard')}
        />
      );
    case 'loading':
      return <QuizLoading player={quiz.player} />;
    case 'quiz':
      return <QuizRound questions={quiz.questions} player={quiz.player} onFinish={finish} />;
    case 'result':
      return (
        <QuizResult
          player={quiz.player}
          score={quiz.score}
          onLeaderboard={() => quiz.setScreen('leaderboard')}
          onPlayAgain={() => {
            quiz.setScore(0);
            quiz.setScreen('home');
          }}
        />
      );
    case 'leaderboard':
      return (
        <Leaderboard
          onBack={() => quiz.setScreen(quiz.score > 0 ? 'result' : 'home')}
          highlightPlayer={quiz.player}
          highlightScore={quiz.score}
        />
      );
  }
}
