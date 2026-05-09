import { useContext } from 'react';
import { ChatContext } from '@/contexts/ChatContext';

export function useAIChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useAIChat must be used within a ChatProvider');
  }
  return ctx;
}
