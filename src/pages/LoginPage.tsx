import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Input } from '@/components/ui';

const LOGO_URL = 'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Logotyper/Untitled%20folder/logo_large.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJMb2dvdHlwZXIvVW50aXRsZWQgZm9sZGVyL2xvZ29fbGFyZ2UucG5nIiwiaWF0IjoxNzcyNjYwMDQ2LCJleHAiOjMzMzA4NjYwMDQ2fQ.C4CUV_phYLpJZrHCl1dYCO_X1X7b5fKiIli6IKTn4Ew';

export function LoginPage() {
  const { user, loading: authLoading, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && user) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="app-backdrop" />

      <div className="relative w-full max-w-md animate-slide-up">
        <Card variant="glass" className="p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <img src={LOGO_URL} alt="El-kretsen" className="h-11 mb-7" />
            <span className="text-eyebrow">Intranät</span>
            <h1 className="text-display text-4xl text-ink-900 mt-2">ELvis Hub</h1>
            <p className="text-ink-500 text-sm mt-3 max-w-xs leading-relaxed">
              Logga in för att få åtkomst till AI-assistent, kunskapsbank och Kretskampen.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={18} strokeWidth={2} />}
            />
            <Input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={18} strokeWidth={2} />}
              error={error ?? undefined}
            />

            <Button type="submit" fullWidth size="lg" loading={loading} rightIcon={<ArrowRight size={18} />}>
              Logga in
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            <ShieldCheck size={14} strokeWidth={2.25} />
            <span>Säker inloggning via El-kretsens SSO</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
