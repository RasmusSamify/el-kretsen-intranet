import type { Citation } from './types';
import { supabase } from './supabase';

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Du är inte inloggad — logga in igen.');
  return `Bearer ${token}`;
}

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
  suggestedFollowUps?: string[];
}

export async function aiSearch(req: AISearchRequest): Promise<AISearchResponse> {
  const res = await fetch('/api/ai-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI-sökning misslyckades (${res.status}): ${text}`);
  }

  return res.json();
}

export type MailCreativity = 'saklig' | 'balanserad' | 'personlig';

export interface MailAssistantRequest {
  customerEmail: string;
  responseLanguage: 'sv' | 'en';
  creativity?: MailCreativity;
}

export interface UsedTemplate {
  id: string;
  similarity: number;
  preview: string;
}

export interface MailAssistantResponse {
  reply: string;
  summary: string;
  sourceFiles: string[];
  gaps: string[];
  language: 'sv' | 'en';
  logId: string | null;
  usedTemplates: UsedTemplate[];
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

export type FeedbackCategory = 'forbattring' | 'bugg' | 'fraga' | 'annat';

export async function submitFeedback(
  category: FeedbackCategory,
  message: string,
): Promise<void> {
  const res = await fetch('/api/submit-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ category, message }),
  });
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) m = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
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
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
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
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
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

// ---------- ELvis-rättelser (användarfeedback för att träna kunskapsbasen) ----------

export type CorrectionType = 'wrong_source' | 'outdated_source' | 'missing_in_kb';

export interface SubmitCorrectionRequest {
  question: string;
  original_answer: string;
  correction_type: CorrectionType;
  cited_source?: string | null;
  suggested_source?: string | null;
  user_note?: string | null;
}

export async function submitCorrection(req: SubmitCorrectionRequest): Promise<{ id: string }> {
  const res = await fetch('/api/submit-correction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) m = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
  return res.json();
}

export async function correctionAction(
  correctionId: string,
  action: 'resolve' | 'ignore' | 'reopen',
): Promise<void> {
  const res = await fetch('/api/correction-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify({ correction_id: correctionId, action }),
  });
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) m = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
}

// ---------- Mail-assistent stil-träning ----------

export interface SubmitMailTrainingRequest {
  customer_email: string;
  ai_draft?: string | null;
  correct_reply: string;
  language: 'sv' | 'en';
  user_note?: string | null;
}

export async function submitMailTraining(req: SubmitMailTrainingRequest): Promise<{ id: string }> {
  const res = await fetch('/api/submit-mail-training', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) m = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
  return res.json();
}

// ---------- Systemstatus + schemalagd crawl ----------

export interface SystemServiceStatus {
  key: string;
  label: string;
  ok: boolean;
  latency_ms: number | null;
  detail: string;
}

export interface CrawlHeartbeat {
  completed_at: string;
  started_at: string;
  total: number;
  ok: number;
  failed: number;
  skipped: number;
  chunks: number;
}

export interface SystemStatusResponse {
  checked_at: string;
  services: SystemServiceStatus[];
  facts: {
    kb: { source_count: number; chunk_count: number; last_kb_update: string | null };
    crawl: {
      last_completed: CrawlHeartbeat | null;
      fallback_last_website_update: string | null;
      in_progress: { done: number; total: number } | null;
    };
    audit: { last_run: string | null; review_pending: number; scheduled: boolean };
    drift: { last_check: string | null };
  };
}

export async function systemStatus(): Promise<SystemStatusResponse> {
  const res = await fetch('/api/system-status', {
    method: 'GET',
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) m = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
  return res.json();
}

export interface TriggerCrawlResponse {
  action?: string;
  processed?: number;
  offset?: number;
  total?: number;
  completed?: boolean;
  idle?: boolean;
}

async function postJob<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let m = `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) m = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(m);
  }
  return res.json() as Promise<T>;
}

export function triggerCrawl(action: 'start' | 'advance' = 'start'): Promise<TriggerCrawlResponse> {
  return postJob<TriggerCrawlResponse>('/api/scheduled-crawl', { action });
}

export interface AuditBatchResult {
  completed: boolean;
  batch_offset_next: number;
  chunks_total: number;
  chunks_processed: number;
  pairs_checked: number;
  contradictions_found: number;
}

export function runAuditBatch(): Promise<AuditBatchResult> {
  // Ingen offset → funktionen fortsätter från sparad position
  return postJob<AuditBatchResult>('/api/kb-audit-contradictions', {});
}

export interface DriftBatchResult {
  completed: boolean;
  batch_offset_next: number;
  sources_checked: number;
  drift_found: number;
  errors: number;
}

export function runDriftBatch(): Promise<DriftBatchResult> {
  return postJob<DriftBatchResult>('/api/kb-detect-drift', {});
}

// ---------- Kunskapslucke-stängaren ----------

export interface GapDraft {
  title: string;
  draft: string;
  needs: string[];
  usedSources: string[];
  contextFound: number;
}

export function draftGap(question: string, gapsText?: string | null): Promise<GapDraft> {
  return postJob<GapDraft>('/api/close-gap', {
    action: 'draft',
    question,
    gaps_text: gapsText ?? null,
  });
}

export function commitGap(
  id: string,
  filename: string,
  content: string,
): Promise<{ ok: true; filename: string; chunks: number }> {
  return postJob('/api/close-gap', { action: 'commit', id, filename, content });
}

export function dismissGap(id: string): Promise<{ ok: true }> {
  return postJob('/api/close-gap', { action: 'dismiss', id });
}

// ---------- Loggbok (möten/samtal + feedback, admin-only) ----------

export interface MeetingLog {
  id: string;
  created_at: string;
  author_email: string | null;
  type: 'meeting' | 'feedback';
  title: string;
  summary: string | null;
  key_points: string[];
  action_items: string[];
  draft_followup: string | null;
  raw_text: string;
}

export function listMeetingLogs(): Promise<{ items: MeetingLog[] }> {
  return postJob('/api/meeting-logs', { action: 'list' });
}

export function createMeetingLog(
  type: 'meeting' | 'feedback',
  rawText: string,
): Promise<{ item: MeetingLog }> {
  return postJob('/api/meeting-logs', { action: 'create', type, raw_text: rawText });
}

export function deleteMeetingLog(id: string): Promise<{ ok: true }> {
  return postJob('/api/meeting-logs', { action: 'delete', id });
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
