import { useState } from 'react';
import { LogOut, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { FeedbackModal } from './FeedbackModal';

const LOGO_URL =
  'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Logotyper/Untitled%20folder/logo_large.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJMb2dvdHlwZXIvVW50aXRsZWQgZm9sZGVyL2xvZ29fbGFyZ2UucG5nIiwiaWF0IjoxNzcyNjYwMDQ2LCJleHAiOjMzMzA4NjYwMDQ2fQ.C4CUV_phYLpJZrHCl1dYCO_X1X7b5fKiIli6IKTn4Ew';

export function Header() {
  const { user, signOut } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const email = user?.email ?? '';

  return (
    <header className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-ink-100 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src={LOGO_URL} alt="El-kretsen" className="h-9 w-auto shrink-0" />
          <div className="hidden sm:block h-7 w-px bg-ink-200" />
          <div className="hidden sm:flex flex-col leading-none min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-400">
              El-kretsen
            </span>
            <h1 className="text-display text-[18px] text-ink-900 mt-1 truncate">ELvis Hub</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {email && (
            <span className="hidden md:block text-[11px] font-semibold text-ink-500 mr-2 tabular-nums truncate max-w-[240px]">
              {email}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MessageSquareText size={14} strokeWidth={1.75} />}
            onClick={() => setFeedbackOpen(true)}
          >
            <span className="hidden sm:inline">Feedback</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LogOut size={14} strokeWidth={1.75} />}
            onClick={() => signOut()}
          >
            <span className="hidden sm:inline">Logga ut</span>
          </Button>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
