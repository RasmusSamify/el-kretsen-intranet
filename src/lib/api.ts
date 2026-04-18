import type { Citation } from './types';

export interface AISearchRequest {
  query: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachedFileContent?: string | null;
}

export interface AISearchResponse {
  answer: string;
  citations: Citation[];
  sourceFiles: string[];
  grounded: boolean;
}

export async function aiSearch(req: AISearchRequest): Promise<AISearchResponse> {
  const res = await fetch('/api/ai-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI-sökning misslyckades (${res.status}): ${text}`);
  }

  return res.json();
}

export interface MailAssistantRequest {
  customerEmail: string;
  responseLanguage: 'sv' | 'en';
}

export interface MailAssistantResponse {
  reply: string;
  summary: string;
  sourceFiles: string[];
  gaps: string[];
  language: 'sv' | 'en';
}

export async function mailAssistant(req: MailAssistantRequest): Promise<MailAssistantResponse> {
  const res = await fetch('/api/mail-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export interface FeeBreakdown {
  code: string;
  productName: string;
  unitFee: number;
  feeUnit: 'kr/st' | 'kr/kg';
  totalFee: number;
}

export interface FeeResponse {
  matched: boolean;
  reasoning: string;
  primary: FeeBreakdown | null;
  green: FeeBreakdown | null;
  citations: string[];
  warning: string | null;
}

export async function calculateFee(req: {
  productDescription: string;
  quantity: number;
  unit: 'st' | 'kg';
}): Promise<FeeResponse> {
  const res = await fetch('/api/fee-calculator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export interface IngestUrlResponse {
  ok: true;
  source: string;
  title: string | null;
  chunks: number;
  tokens: number;
}

export async function ingestUrl(url: string): Promise<IngestUrlResponse> {
  const res = await fetch('/api/ingest-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return res.json();
}
