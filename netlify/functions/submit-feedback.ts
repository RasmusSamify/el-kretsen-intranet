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

  // Skicka Resend-notis till info@samify.se. Awaiti:as så Lambda inte fryser
  // promise:t innan det kört klart (Netlify-/AWS-gotcha).
  await notify({
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
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const debugAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const writeNote = (note: string) =>
    debugAdmin.from('user_feedback').update({ internal_note: note }).eq('id', params.feedbackId);

  await writeNote('notify() entered');

  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFICATION_EMAIL;
  if (!resendKey || !notifyTo) {
    await writeNote(`MISSING ENV — resendKey=${!!resendKey}, notifyTo=${!!notifyTo}`);
    return;
  }
  await writeNote(`env OK — resendKey len=${resendKey.length}, notifyTo=${notifyTo}`);

  const subject = `[ELvis Hub] ${CATEGORY_LABEL[params.category]}: "${params.message.slice(0, 60)}${params.message.length > 60 ? '…' : ''}"`;
  const formattedDate = new Date().toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const senderEmail = escapeHtml(params.userEmail ?? 'Okänd användare');
  const categoryLabel = escapeHtml(CATEGORY_LABEL[params.category]);
  const messageHtml = escapeHtml(params.message).replace(/\n/g, '<br>');

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ny feedback från ELvis Hub</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 6px 32px -8px rgba(15,23,42,0.12);">

          <!-- Hero gradient header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0284c7 0%,#7c3aed 100%);padding:36px 40px 32px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.78);margin-bottom:10px;">
                El-kretsen &middot; ELvis Hub
              </div>
              <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.01em;">
                Ny feedback inkommen
              </div>
              <div style="font-size:14px;color:rgba(255,255,255,0.86);margin-top:8px;line-height:1.45;">
                ${senderEmail} har skickat in ett ${categoryLabel.toLowerCase()}.
              </div>
            </td>
          </tr>

          <!-- Meta row -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:top;padding-right:16px;">
                    <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">Från</div>
                    <div style="font-size:15px;font-weight:600;color:#1e293b;line-height:1.3;">${senderEmail}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:4px;">${formattedDate}</div>
                  </td>
                  <td align="right" style="vertical-align:top;white-space:nowrap;">
                    <span style="display:inline-block;padding:7px 14px;border-radius:999px;background:linear-gradient(135deg,#e0f2fe 0%,#ede9fe 100%);color:#0369a1;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:1px solid rgba(2,132,199,0.15);">
                      ${categoryLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message card -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;margin-bottom:10px;">Meddelande</div>
              <div style="background:#f8fafc;border-left:4px solid #0284c7;border-radius:14px;padding:22px 26px;font-size:15px;line-height:1.65;color:#1e293b;">
                ${messageHtml}
              </div>
            </td>
          </tr>

          <!-- Action card -->
          <tr>
            <td style="padding:24px 40px;">
              <div style="background:linear-gradient(135deg,#f0f9ff 0%,#faf5ff 100%);border:1px solid #e0f2fe;border-radius:16px;padding:20px 24px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0369a1;margin-bottom:6px;">Nästa steg</div>
                <div style="font-size:13px;line-height:1.6;color:#475569;">
                  Svara direkt p&aring; det h&auml;r mejlet &mdash; det g&aring;r till ${senderEmail}. Eller hantera &auml;rendet i Supabase-tabellen <code style="background:rgba(2,132,199,0.1);padding:2px 7px;border-radius:5px;font-family:'SF Mono','Monaco','Cascadia Code',monospace;font-size:12px;color:#0369a1;">user_feedback</code> n&auml;r du har tid.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f1f5f9;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
                      Feedback-id: <span style="font-family:'SF Mono','Monaco','Cascadia Code',monospace;color:#64748b;">${params.feedbackId}</span>
                    </div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <a href="https://elkretsen.netlify.app" style="font-size:11px;color:#94a3b8;text-decoration:none;border-bottom:1px solid #e2e8f0;">elkretsen.netlify.app</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Outer footer -->
        <div style="font-size:10px;color:#cbd5e1;margin-top:20px;line-height:1.5;">
          Skickat fr&aring;n ELvis Hub via Samify.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        // Skickas från Samifys verifierade subdomän updates.samify.se.
        from: 'ELvis Hub <hub@updates.samify.se>',
        to: notifyTo.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: params.userEmail ?? undefined,
        subject,
        html,
      }),
    });
    if (res.ok) {
      await debugAdmin.from('user_feedback').update({ notified: true, internal_note: null }).eq('id', params.feedbackId);
    } else {
      const errBody = await res.text().catch(() => '<no body>');
      const diag = `Resend ${res.status}: ${errBody.slice(0, 400)}`;
      console.warn(`feedback notify: ${diag}`);
      await writeNote(diag);
    }
  } catch (e) {
    const msg = `notify exception: ${(e as Error).message}`;
    console.warn(msg);
    await writeNote(msg);
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
