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
const MATCH_THRESHOLD = 0.3;
const MATCH_COUNT = 8;

const SYSTEM_PROMPT = `Du är El-kretsens interna AI-assistent för producentansvar, avfallshantering och regelefterlevnad. El-kretsen är Sveriges nationella insamlingssystem för WEEE (elektronikavfall) och batterier.

ABSOLUTA REGLER (avvik ALDRIG):
1. Du svarar ENDAST baserat på innehåll i <kunskapsbas>-taggen. Hitta aldrig på fakta, även om det skulle vara en liten detalj.
2. Varje konkret påstående MÅSTE ha en inline-citation i formatet: [källa: filnamn, stycke N]. Använd EXAKT detta format.
3. Om kunskapsbasen inte räcker för att besvara frågan, svara ordagrant: "Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig."
4. Citera juridiska termer, paragrafer och produktkoder ordagrant från kunskapsbasen.
5. Svara ALLTID på svenska.
6. Vid motstridiga källor: redovisa båda och rekommendera att användaren verifierar.
7. Spekulera aldrig om framtida regelverk som inte står i kunskapsbasen.

SVARSFORMAT (följ denna struktur när du har träffar i kunskapsbasen):

## Svar
[1-2 meningars direkt slutsats med minst en inline-citation]

## Detaljer
- [Bulletpunkter med inline-citationer för varje faktapåstående]

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

  const { data: matches, error: matchError } = await supabase.rpc('match_kb_chunks', {
    query_embedding: embedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
  });

  if (matchError) {
    return json({ error: `DB match failed: ${matchError.message}` }, 502);
  }

  const chunks = (matches ?? []) as MatchedChunk[];

  // Step 3: No matches → return not-found answer directly
  if (chunks.length === 0) {
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
      max_tokens: 2000,
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

  return json(
    {
      answer,
      citations,
      sourceFiles: referencedFiles,
      grounded: true,
    },
    200,
  );
};

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
