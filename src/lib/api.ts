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
