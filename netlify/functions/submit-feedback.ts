import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface SubmitFeedbackRequest {
  category: 'forbattring' | 'bugg' | 'fraga' | 'annat';
  message: string;
}

const VALID_CATEGORIES = ['forbattring', 'bugg', 'fraga', 'annat'] as const;
const CATEGORY_LABEL: Record<(typeof VALID_CATEGORIES)[number], string> = {
  forbattring: 'Förbättringsförslag',
  bugg: 'Bugg / problem',
  fraga: 'Fråga',
  annat: 'Annat',
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders() });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server not configured.' }, 500);
  }

  let body: SubmitFeedbackRequest;
  try {
    body = (await req.json()) as SubmitFeedbackRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!VALID_CATEGORIES.includes(body.category)) {
    return json({ error: `Ogiltig kategori (måste vara: ${VALID_CATEGORIES.join(', ')})` }, 400);
  }

  const message = (body.message ?? '').trim();
  if (message.length < 5) return json({ error: 'Meddelandet är för kort (minst 5 tecken).' }, 400);
  if (message.length > 4000) return json({ error: 'Meddelandet är för långt (max 4000 tecken).' }, 400);

  // Authenticated submit krävs — vi vill veta vem som lämnade in.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Du måste vara inloggad för att skicka feedback.' }, 401);
  }

  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const verifier = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error } = await verifier.auth.getUser(authHeader.slice(7));
    if (error || !userData.user) return json({ error: 'Ogiltig session.' }, 401);
    userId = userData.user.id;
    userEmail = userData.user.email ?? null;
  } catch {
    return json({ error: 'Auth-verifiering misslyckades.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error: insertError } = await admin
    .from('user_feedback')
    .insert({
      user_id: userId,
      user_email: userEmail,
      category: body.category,
      message,
    })
    .select('id')
    .single();

  if (insertError) {
    return json({ error: `DB-insert misslyckades: ${insertError.message}` }, 502);
  }

  // Skicka Resend-notis till info@samify.se. Aldrig blocka submit på mejl-fel.
  void notify({
    feedbackId: inserted.id,
    category: body.category,
    message,
    userEmail,
  });

  return json({ ok: true }, 200);
};

async function notify(params: {
  feedbackId: string;
  category: SubmitFeedbackRequest['category'];
  message: string;
  userEmail: string | null;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFICATION_EMAIL;
  if (!resendKey || !notifyTo) return;

  const subject = `[ELvis Hub] ${CATEGORY_LABEL[params.category]}: "${params.message.slice(0, 60)}${params.message.length > 60 ? '…' : ''}"`;
  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 560px; color: #1e293b;">
      <h2 style="color: #0369a1; margin-bottom: 8px;">Ny feedback från ELvis Hub</h2>
      <p style="color: #475569; margin: 0 0 20px;">
        ${escapeHtml(params.userEmail ?? 'okänd användare')} skickade in
        <strong>${escapeHtml(CATEGORY_LABEL[params.category])}</strong>.
      </p>

      <div style="background: #f1f5f9; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
        <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Meddelande</strong>
        <p style="margin: 6px 0 0; font-size: 15px; line-height: 1.55; white-space: pre-wrap;">${escapeHtml(params.message)}</p>
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        Feedback-id: <code>${params.feedbackId}</code> · Hantera i Supabase-tabell <code>user_feedback</code>.
      </p>
    </div>`.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        // Använd Resends test-domän, samma som logAndNotifyUnanswered i
        // ai-search.ts. Funkar utan ytterligare DNS-verifiering så länge
        // mottagaren (info@samify.se) finns som verifierad adress i kontot.
        from: 'ELvis Hub <onboarding@resend.dev>',
        to: notifyTo.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: params.userEmail ?? undefined,
        subject,
        html,
      }),
    });
    if (res.ok) {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await admin.from('user_feedback').update({ notified: true }).eq('id', params.feedbackId);
    } else {
      // Logga full body så vi ser exakt vad Resend klagar på i Netlify-loggarna
      const errBody = await res.text().catch(() => '<no body>');
      console.warn(`feedback notify: Resend ${res.status} — ${errBody.slice(0, 400)}`);
    }
  } catch (e) {
    console.warn('feedback notify failed:', (e as Error).message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

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
  path: '/api/submit-feedback',
};
