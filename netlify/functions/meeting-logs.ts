import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './_shared/auth';

/**
 * Intern loggbok (admin-only): möten/samtal + feedback mellan Samify och Linnea.
 * Actions:
 *  - list:   hämta senaste posterna
 *  - create: AI-strukturera inklistrad text (sammanfattning, punkter, action items,
 *            utkast till uppföljning) och spara
 *  - delete: ta bort en post
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server not configured' }, 500);

  let body: { action?: string; id?: string; type?: string; raw_text?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- LIST ----------
  if (body.action === 'list') {
    const { data, error } = await admin
      .from('meeting_logs')
      .select('id, created_at, author_email, type, title, summary, key_points, action_items, draft_followup, raw_text')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return json({ error: error.message }, 502);
    return json({ items: data ?? [] }, 200);
  }

  // ---------- DELETE ----------
  if (body.action === 'delete') {
    if (!body.id) return json({ error: 'id krävs' }, 400);
    const { error } = await admin.from('meeting_logs').delete().eq('id', body.id);
    if (error) return json({ error: error.message }, 502);
    return json({ ok: true }, 200);
  }

  // ---------- CREATE ----------
  const type: 'meeting' | 'feedback' = body.type === 'feedback' ? 'feedback' : 'meeting';
  const rawText = (body.raw_text ?? '').trim();
  if (rawText.length < 10) return json({ error: 'För lite text (minst 10 tecken)' }, 400);
  if (rawText.length > 30000) return json({ error: 'För lång text (max 30 000 tecken)' }, 413);

  let structured = {
    title: rawText.slice(0, 60),
    summary: '',
    key_points: [] as string[],
    action_items: [] as string[],
    draft_followup: '',
  };

  if (anthropicKey) {
    const system = `Du strukturerar interna anteckningar för Samify (leverantör av intranätet ELvis Hub) i samarbete med Linnea på El-kretsen (kund). Sammanfatta SAKLIGT utifrån det som faktiskt står i texten — hitta inte på. ${
      type === 'feedback' ? 'Detta är en feedback-notering.' : 'Detta är mötes-/samtalsanteckningar.'
    }

Svara ENDAST med giltig JSON:
{
  "title": "kort titel (max ca 8 ord)",
  "summary": "2-4 meningar som fångar kärnan",
  "key_points": ["viktig punkt", "..."],
  "action_items": ["konkret att-göra, ange vem om det framgår", "..."],
  "draft_followup": "kort utkast till uppföljningsmail, eller tom sträng om ej relevant"
}`;

    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          temperature: 0.3,
          system,
          messages: [{ role: 'user', content: `<anteckningar>\n${rawText}\n</anteckningar>` }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        const rawJson = (data.content?.find((c) => c.type === 'text')?.text ?? '')
          .replace(/```json|```/g, '')
          .trim();
        const parsed = JSON.parse(rawJson);
        structured = {
          title: (parsed.title || structured.title).slice(0, 200),
          summary: parsed.summary ?? '',
          key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
          action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
          draft_followup: parsed.draft_followup ?? '',
        };
      }
    } catch {
      /* AI-strukturering misslyckades — spara ändå råtexten med fallback-titel */
    }
  }

  const { data, error } = await admin
    .from('meeting_logs')
    .insert({
      created_by: auth.user.id,
      author_email: auth.user.email ?? null,
      type,
      title: structured.title,
      raw_text: rawText,
      summary: structured.summary,
      key_points: structured.key_points,
      action_items: structured.action_items,
      draft_followup: structured.draft_followup,
    })
    .select('id, created_at, author_email, type, title, summary, key_points, action_items, draft_followup, raw_text')
    .single();

  if (error) return json({ error: error.message }, 502);
  return json({ item: data }, 200);
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export const config: Config = {
  path: '/api/meeting-logs',
};
