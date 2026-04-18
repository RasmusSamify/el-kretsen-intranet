import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error('Supabase env variables saknas. Kontrollera VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const BUCKETS = {
  documents: 'intranet-dokument',
  knowledge: 'Linneas AI-losning',
  quiz: 'Quiz dokument',
} as const;
