import { LogOut, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { FeedbackModal } from './FeedbackModal';
import { useState } from 'react';

const LOGO_URL = 'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Logotyper/Untitled%20folder/logo_large.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJMb2dvdHlwZXIvVW50aXRsZWQgZm9sZGVyL2xvZ29fbGFyZ2UucG5nIiwiaWF0IjoxNzcyNjYwMDQ2LCJleHAiOjMzMzA4NjYwMDQ2fQ.C4CUV_phYLpJZrHCl1dYCO_X1X7b5fKiIli6IKTn4Ew';

export function Header() {
  const { signOut } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <header className="relative z-20 bg-white/85 backdrop-blur-xl border-b border-white/60 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} alt="El-kretsen" className="h-9 w-auto" />
          <div className="hidden sm:block h-7 w-px bg-ink-200" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">El-kretsen</span>
            <h1 className="text-display text-[22px] text-ink-900 mt-1">ELvis Hub</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MessageSquareText size={16} strokeWidth={2.25} />}
            onClick={() => setFeedbackOpen(true)}
          >
            <span className="hidden sm:inline">Feedback</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LogOut size={16} strokeWidth={2.25} />}
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
