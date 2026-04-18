import { useState } from 'react';
import { LogOut, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { FeedbackModal } from './FeedbackModal';

export function Header() {
  const { user, signOut } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const email = user?.email ?? '';

  return (
    <header className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-ink-100 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-end gap-2 px-6 py-3">
        {email && (
          <span className="hidden sm:block text-[11px] font-semibold text-ink-500 mr-2 tabular-nums truncate max-w-[240px]">
            {email}
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<MessageSquareText size={14} strokeWidth={2.25} />}
          onClick={() => setFeedbackOpen(true)}
        >
          <span className="hidden sm:inline">Feedback</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LogOut size={14} strokeWidth={2.25} />}
          onClick={() => signOut()}
        >
          <span className="hidden sm:inline">Logga ut</span>
        </Button>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
