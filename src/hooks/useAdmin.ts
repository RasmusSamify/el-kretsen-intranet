import { useMemo } from 'react';
import { useAuth } from './useAuth';

/**
 * Admin-detektion baserad på env-var VITE_ADMIN_EMAILS (kommaseparerad).
 * Frontend-sidans roll-check är BARA en visuell/UX-gating — de riktiga
 * säkerhetskontrollerna görs i backend (Netlify Functions) via samma
 * ADMIN_EMAILS env var och JWT-verifiering.
 */
export function useAdmin() {
  const { user, loading } = useAuth();

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    const raw = import.meta.env.VITE_ADMIN_EMAILS ?? '';
    const list = raw
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(user.email.toLowerCase());
  }, [user?.email]);

  return { isAdmin, loading, email: user?.email ?? null };
}
