export interface Citation {
  id: string;
  filename: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  sourceFiles?: string[];
  grounded?: boolean;
  timestamp: number;
}

export interface FAQEntry {
  id: string;
  question_text: string;
  count: number;
}
