// ═══════════════════════════════════════════════
//  config.js — Delade konstanter
// ═══════════════════════════════════════════════

const SUPABASE_URL      = 'https://jnwatbnkdzuyhqmcerej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impud2F0Ym5rZHp1eWhxbWNlcmVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzczNDcsImV4cCI6MjA4ODA1MzM0N30._A6BCYepTsITJNYgJBUPb79TDR3ln45DPvbmy8Igyoo';
const BUCKET_DOCUMENTS  = 'intranet-dokument';
const BUCKET_KNOWLEDGE  = 'Linneas AI-losning';   // Bucket med de 17 TXT-filerna för AI

// Anthropic API — ersätt med din nyckel eller hämta från Supabase Edge Function
const ANTHROPIC_API_KEY = 'ERSÄTT_MED_DIN_NYCKEL';
const CLAUDE_MODEL      = 'claude-sonnet-4-20250514';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
