import type { Config } from '@netlify/functions';

interface EmbedRequest {
  texts: string[];
  inputType?: 'document' | 'query';
}

interface EmbedResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3';
const DIMENSIONS = 1024;

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    return json({ error: 'VOYAGE_API_KEY is not configured in Netlify environment.' }, 500);
  }

  let body: EmbedRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!Array.isArray(body.texts) || body.texts.length === 0) {
    return json({ error: 'Field `texts` must be a non-empty array' }, 400);
  }

  if (body.texts.length > 128) {
    return json({ error: 'Maximum 128 texts per request' }, 400);
  }

  const response = await fetch(VOYAGE_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: body.texts,
      input_type: body.inputType ?? 'document',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return json({ error: `Voyage API error (${response.status}): ${errorText}` }, 502);
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  const embeddings = data.data.map((d) => d.embedding);

  const payload: EmbedResponse = {
    embeddings,
    model: MODEL,
    dimensions: DIMENSIONS,
  };

  return json(payload, 200);
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
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export const config: Config = {
  path: '/api/embed-kb',
};
