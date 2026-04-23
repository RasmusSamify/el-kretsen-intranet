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
  logId: string | null;
}

export async function mailAssistant(
  req: MailAssistantRequest,
  token?: string,
): Promise<MailAssistantResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/mail-assistant', {
    method: 'POST',
    headers,
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

export interface AnswerFeedbackRequest {
  feature: 'mail_assistant' | 'ai_search';
  reference_id?: string | null;
  rating: 'up' | 'down';
  comment?: string | null;
}

export async function submitAnswerFeedback(
  req: AnswerFeedbackRequest,
  token?: string,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/answer-feedback', {
    method: 'POST',
    headers,
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

export interface IngestFileResponse {
  ok: true;
  source: string;
  chunks: number;
  tokens: number;
}

export async function ingestFile(filename: string, content: string): Promise<IngestFileResponse> {
  const res = await fetch('/api/ingest-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content }),
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

// ---------- Admin-operationer (kräver admin-email i ADMIN_EMAILS) ----------

export interface AdminGetResponse {
  filename: string;
  content: string;
  chunk_count: number;
  warning: string | null;
}

async function adminRequest<T>(body: object, token: string): Promise<T> {
  const res = await fetch('/api/admin-source-ops', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) message = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function adminGetSource(filename: string, token: string): Promise<AdminGetResponse> {
  return adminRequest<AdminGetResponse>({ action: 'get', filename }, token);
}

export async function adminUpdateSource(
  filename: string,
  content: string,
  token: string,
): Promise<{ ok: true; filename: string; chunks: number }> {
  return adminRequest({ action: 'update', filename, content }, token);
}

export async function adminDeleteSource(
  filename: string,
  token: string,
): Promise<{ ok: true; filename: string; chunks_removed: number }> {
  return adminRequest({ action: 'delete', filename }, token);
}
