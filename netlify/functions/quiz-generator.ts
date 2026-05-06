import type { Config } from '@netlify/functions';

interface QuizRequest {
  categoryId: string;
  count: number;
}

interface Question {
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

const KB_URL =
  'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Quiz%20dokument/Elkretsen_Kunskapsbas_Samlad_Quiz.txt?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJRdWl6IGRva3VtZW50L0Vsa3JldHNlbl9LdW5za2Fwc2Jhc19TYW1sYWRfUXVpei50eHQiLCJpYXQiOjE3NzI2NTI2NzYsImV4cCI6NDkyNjI1MjY3Nn0.3zkcFjaJmwLPFEoWa9sJx15eq2xil9NiteRPb76mtKQ';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'alla kategorier',
  C: 'EU & Reglering',
  A: 'Ekonomi',
  B: 'Teknik',
  D: 'Juridik',
};

const SYSTEM_INSTRUCTIONS = `Du genererar flervalsfrågor på SVENSKA från en intern kunskapsbas hos El-kretsen (Sveriges nationella insamlingssystem för WEEE och batterier). Plocka frågor från HELA kunskapsbasen och sprid ut dem så att olika delar täcks.

Krav på varje fråga:
- Exakt 4 svarsalternativ.
- Exakt ett rätt svar (index 0–3 i "correct").
- "explanation" ska kort förklara varför det rätta svaret är rätt, grundat i kunskapsbasen.
- Skriv distraktorer som är rimliga men entydigt felaktiga.

Svara ENDAST med giltig JSON i exakt detta format, utan markdown, utan kommentar, utan text före eller efter:
{ "questions": [ { "question": "...", "answers": ["A","B","C","D"], "correct": 0, "explanation": "..." } ] }`;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: { message: 'ANTHROPIC_API_KEY saknas i Netlify env.' } }, 500);

  let body: QuizRequest;
  try {
    body = (await req.json()) as QuizRequest;
  } catch {
    return json({ error: { message: 'Invalid JSON body' } }, 400);
  }

  const categoryId = body.categoryId ?? 'all';
  const count = clamp(body.count ?? 10, 1, 20);
  const catLabel = CATEGORY_LABELS[categoryId] ?? CATEGORY_LABELS.all;

  let kb: string;
  try {
    const kbRes = await fetch(KB_URL);
    if (!kbRes.ok) throw new Error(`KB fetch ${kbRes.status}`);
    kb = await kbRes.text();
  } catch (e) {
    return json({ error: { message: `Kunde inte hämta kunskapsbas: ${(e as Error).message}` } }, 502);
  }

  const seed = Date.now();

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      system: [
        { type: 'text', text: SYSTEM_INSTRUCTIONS },
        {
          type: 'text',
          text: `<kunskapsbas>\n${kb}\n</kunskapsbas>`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `SESSION: ${seed}. Skapa ${count} flervalsfrågor om: ${catLabel}.`,
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return json({ error: { message: `Claude API ${claudeRes.status}: ${errText}` } }, 502);
  }

  const claudeData = (await claudeRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = claudeData.content?.find((c) => c.type === 'text')?.text ?? '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  let questions: Question[];
  try {
    const parsed = JSON.parse(cleaned) as { questions?: Question[] };
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Saknar "questions"-array i Claude-svaret');
    }
    questions = parsed.questions;
  } catch (e) {
    return json(
      { error: { message: `Kunde inte tolka Claude-svar som JSON: ${(e as Error).message}` } },
      502,
    );
  }

  return json({ questions }, 200);
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export const config: Config = {
  path: '/api/quiz-generator',
};
