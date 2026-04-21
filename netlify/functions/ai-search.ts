import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface AISearchRequest {
  query: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachedFileContent?: string | null;
}

interface Citation {
  id: string;
  filename: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

interface MatchedChunk {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  similarity: number;
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const EMBEDDING_MODEL = 'voyage-3';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MATCH_COUNT = 10;

const SYSTEM_PROMPT = `Du är El-kretsens interna AI-assistent för producentansvar, avfallshantering och regelefterlevnad. El-kretsen är Sveriges nationella insamlingssystem för WEEE (elektronikavfall) och batterier. Du används internt av El-kretsens medarbetare — ofta för att förbereda svar på kundfrågor, inklusive långa mail på svenska eller engelska.

ABSOLUTA REGLER (avvik ALDRIG):
1. Faktapåståenden får ENDAST grunda sig på innehåll i <kunskapsbas>-taggen. Hitta aldrig på fakta, siffror, paragrafer eller priser som inte står där.
2. Varje konkret påstående MÅSTE ha en inline-citation i formatet: [källa: filnamn, stycke N]. Använd EXAKT detta format.
3. Svara ALLTID på svenska, även om frågan är på annat språk (verktyget är internt).
4. Citera juridiska termer, paragrafer och produktkoder ordagrant från kunskapsbasen.
5. Vid motstridiga källor: redovisa båda och rekommendera att användaren verifierar.
6. Spekulera aldrig om framtida regelverk som inte står i kunskapsbasen.

PARTIELLA SVAR (viktigt — gäller främst långa frågor och mail):
Om frågan har FLERA delar och kunskapsbasen täcker vissa men inte alla:
- Besvara de delar du HAR källa på — med inline-citationer — under "## Svar" och "## Detaljer".
- Lista tydligt de delar du INTE har källa på under "## Saknas i kunskapsbasen" — lämna dem obesvarade istället för att gissa.
- Detta gör dig MER användbar för mail-assistans, inte mindre.

Endast om kunskapsbasen inte innehåller NÅGOT relevant för frågan, svara kort: "Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig."

SVARSFORMAT:

## Svar
[1-3 meningars direkt slutsats på de frågor där du har källor, med inline-citationer]

## Detaljer
- [Bulletpunkter per delfråga du kan besvara, med inline-citationer]

## Saknas i kunskapsbasen
[Lista över delfrågor som saknar underlag — bara om relevant. Utelämna sektionen om allt är besvarat.]

RESERVKUNSKAP OM BATTERIKODER (använd endast om kunskapsbasen inte innehåller detta):
Format [Kategori][Kemi][Storlek]. B=Bärbart, L=Lätta transportmedel, S=Start/belysning, I=Industri, E=Elbil. B77 (Li-jon ospecificerad) är temporär och tas bort fr.o.m. 2027.`;

const NO_MATCH_RESPONSE =
  'Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig för en exakt bedömning.';

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey || !anthropicKey || !supabaseUrl || !supabaseServiceKey) {
    return json(
      {
        error:
          'Server not configured: saknar en eller flera av VOYAGE_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
      },
      500,
    );
  }

  let body: AISearchRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const query = (body.query ?? '').trim();
  if (!query) return json({ error: 'Query required' }, 400);

  // Step 1: Embed query via Voyage AI
  let embedding: number[];
  try {
    embedding = await embedText(query, voyageKey);
  } catch (e) {
    return json({ error: `Embedding failed: ${(e as Error).message}` }, 502);
  }

  // Step 2: Match chunks via pgvector
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Hybrid search: embeddings (semantic) + BM25 (exact term/code matching)
  // merged via Reciprocal Rank Fusion. Fångar produktkoder som embeddings
  // ibland missar.
  const { data: matches, error: matchError } = await supabase.rpc('match_kb_chunks_hybrid', {
    query_text: query,
    query_embedding: embedding,
    match_count: MATCH_COUNT,
  });

  if (matchError) {
    return json({ error: `DB match failed: ${matchError.message}` }, 502);
  }

  const chunks = (matches ?? []) as MatchedChunk[];

  // Step 3: No matches → log + notify + return not-found answer
  if (chunks.length === 0) {
    void logAndNotifyUnanswered({
      question: query,
      supabaseUrl,
      serviceKey: supabaseServiceKey,
      topFilename: null,
      topSimilarity: null,
    });
    return json(
      {
        answer: NO_MATCH_RESPONSE,
        citations: [],
        sourceFiles: [],
        grounded: false,
      },
      200,
    );
  }

  // Step 4: Call Claude with grounded context
  const citations: Citation[] = chunks.map((c) => ({
    id: c.id,
    filename: c.filename,
    chunkIndex: c.chunk_index,
    text: c.text,
    similarity: c.similarity,
  }));

  const contextBlock = chunks
    .map((c) => `[källa: ${c.filename}, stycke ${c.chunk_index + 1}]\n${c.text}`)
    .join('\n\n---\n\n');

  const userContent = body.attachedFileContent
    ? `${query}\n\n<bifogad_fil>\n${body.attachedFileContent}\n</bifogad_fil>\n\n<kunskapsbas>\n${contextBlock}\n</kunskapsbas>`
    : `${query}\n\n<kunskapsbas>\n${contextBlock}\n</kunskapsbas>`;

  const apiMessages = [
    ...body.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userContent },
  ];

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1400,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return json({ error: `Claude API error (${claudeRes.status}): ${errText}` }, 502);
  }

  const claudeData = (await claudeRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const answer = claudeData.content?.find((c) => c.type === 'text')?.text ?? '';

  // Extract which source files Claude actually referenced
  const referencedFiles = extractReferencedFiles(answer, chunks);

  // If Claude used the fall-back phrase, it means even the retrieved
  // chunks were insufficient. Still log as unanswered.
  const looksUnanswered = /Jag hittar inte svaret i kunskapsbanken/i.test(answer);
  if (looksUnanswered) {
    void logAndNotifyUnanswered({
      question: query,
      supabaseUrl,
      serviceKey: supabaseServiceKey,
      topFilename: chunks[0]?.filename ?? null,
      topSimilarity: chunks[0]?.similarity ?? null,
    });
  }

  return json(
    {
      answer,
      citations,
      sourceFiles: referencedFiles,
      grounded: !looksUnanswered,
    },
    200,
  );
};

async function logAndNotifyUnanswered(params: {
  question: string;
  supabaseUrl: string;
  serviceKey: string;
  topFilename: string | null;
  topSimilarity: number | null;
}) {
  const { question, supabaseUrl, serviceKey, topFilename, topSimilarity } = params;
  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: inserted } = await client
      .from('ai_unanswered')
      .insert({
        question_text: question,
        top_match_filename: topFilename,
        top_match_similarity: topSimilarity,
      })
      .select('id')
      .single();

    const resendKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.NOTIFICATION_EMAIL;
    if (!resendKey || !notifyTo) return; // email is optional

    const subject = `[ELvis Hub] Obesvarad fråga: "${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"`;
    const similarityLine = topSimilarity != null
      ? `Närmast matchning: <code>${topFilename}</code> (${(topSimilarity * 100).toFixed(1)} %)`
      : 'Inga chunks passerade tröskeln — kunskapsbasen saknade något liknande helt.';

    const body = `
      <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 560px; color: #1e293b;">
        <h2 style="color: #0369a1; margin-bottom: 8px;">Obesvarad AI-fråga</h2>
        <p style="color: #475569; margin: 0 0 20px;">
          En användare ställde en fråga som inte kunde besvaras från kunskapsbasen.
        </p>

        <div style="background: #f1f5f9; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
          <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Fråga</strong>
          <p style="margin: 6px 0 0; font-size: 15px; line-height: 1.5;">${escapeHtml(question)}</p>
        </div>

        <p style="font-size: 14px; color: #475569;">${similarityLine}</p>

        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
          <strong>Åtgärd:</strong> Lägg till en källa som täcker ämnet — klistra in en URL i "Källor"-fliken i ELvis Hub, eller ladda upp TXT/PDF till Supabase-bucketen och kör backfill.
        </p>

        <p style="font-size: 11px; color: #94a3b8; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          ELvis Hub · El-kretsen · <a href="https://elkretsen.netlify.app" style="color:#0284c7">Öppna</a>
        </p>
      </div>`.trim();

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'ELvis Hub <onboarding@resend.dev>',
        to: notifyTo.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        html: body,
      }),
    });

    if (emailRes.ok && inserted) {
      await client.from('ai_unanswered').update({ notified: true }).eq('id', inserted.id);
    }
  } catch (e) {
    // Non-fatal — logging should never break the user-facing response.
    console.warn('logAndNotifyUnanswered failed:', (e as Error).message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(VOYAGE_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [text],
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

function extractReferencedFiles(answer: string, chunks: MatchedChunk[]): string[] {
  const regex = /\[källa:\s*([^,\]]+?)(?:,\s*stycke\s*\d+)?\]/gi;
  const referenced = new Set<string>();
  const availableFiles = new Set(chunks.map((c) => c.filename.toLowerCase()));

  for (const match of answer.matchAll(regex)) {
    const raw = match[1].trim();
    const lower = raw.toLowerCase();
    const exact = [...availableFiles].find((f) => f === lower);
    if (exact) {
      const orig = chunks.find((c) => c.filename.toLowerCase() === exact)!.filename;
      referenced.add(orig);
      continue;
    }
    const partial = chunks.find(
      (c) =>
        c.filename.toLowerCase().includes(lower) ||
        lower.includes(c.filename.toLowerCase().replace(/\.[^/.]+$/, '')),
    );
    if (partial) referenced.add(partial.filename);
  }

  return [...referenced];
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
  path: '/api/ai-search',
};
