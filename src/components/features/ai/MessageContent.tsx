import { useMemo, type ReactNode } from 'react';
import type { Citation } from '@/lib/types';
import { extractClaimSentence } from '@/lib/chunkHighlight';
import { CitationChip } from './CitationChip';

const CITATION_REGEX = /\[källa:\s*([^,\]]+?)(?:,\s*stycke\s*(\d+))?\]/gi;

interface MessageContentProps {
  text: string;
  citations?: Citation[];
}

export function MessageContent({ text, citations = [] }: MessageContentProps) {
  const parsed = useMemo(() => parseWithCitations(text, citations), [text, citations]);
  return <div className="prose-chat">{parsed}</div>;
}

function parseWithCitations(text: string, citations: Citation[]): ReactNode[] {
  const blocks = splitBlocks(text);
  const citationIndex = new Map<string, { citation: Citation; number: number }>();
  let nextNumber = 1;

  for (const c of citations) {
    const key = citationKey(c.filename, c.chunkIndex);
    if (!citationIndex.has(key)) {
      citationIndex.set(key, { citation: c, number: nextNumber++ });
    }
  }

  return blocks.map((block, i) => renderBlock(block, i, citations, citationIndex, text));
}

function citationKey(filename: string, chunkIndex: number): string {
  return `${filename.toLowerCase()}::${chunkIndex}`;
}

type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

function splitBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: 'p', text: paragraphBuffer.join(' ').trim() });
      paragraphBuffer = [];
    }
  };
  const flushList = () => {
    if (listBuffer) {
      blocks.push({ ...listBuffer });
      listBuffer = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);
    const ul = trimmed.match(/^[-•*]\s+(.+)$/);
    const ol = trimmed.match(/^\d+\.\s+(.+)$/);

    if (h2) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h2', text: h2[1] });
    } else if (h3) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h3', text: h3[1] });
    } else if (ul) {
      flushParagraph();
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList();
        listBuffer = { type: 'ul', items: [] };
      }
      listBuffer.items.push(ul[1]);
    } else if (ol) {
      flushParagraph();
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList();
        listBuffer = { type: 'ol', items: [] };
      }
      listBuffer.items.push(ol[1]);
    } else {
      flushList();
      paragraphBuffer.push(trimmed);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderBlock(
  block: Block,
  key: number,
  citations: Citation[],
  index: Map<string, { citation: Citation; number: number }>,
  fullText: string,
): ReactNode {
  switch (block.type) {
    case 'h2':
      return (
        <h3 key={key} className="text-[15px] font-bold text-ink-900 mt-4 mb-2 first:mt-0 border-b border-ink-100 pb-1.5">
          {renderInline(block.text, citations, index, fullText)}
        </h3>
      );
    case 'h3':
      return (
        <h4 key={key} className="text-[13px] font-bold text-ink-800 mt-3 mb-1.5 first:mt-0">
          {renderInline(block.text, citations, index, fullText)}
        </h4>
      );
    case 'ul':
      return (
        <ul key={key} className="list-disc pl-5 my-2 space-y-1 text-[14px] marker:text-brand-400">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, citations, index, fullText)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="list-decimal pl-5 my-2 space-y-1 text-[14px] marker:text-brand-500 marker:font-bold">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item, citations, index, fullText)}</li>
          ))}
        </ol>
      );
    case 'p':
      return (
        <p key={key} className="text-[14px] text-ink-800 leading-relaxed my-2 first:mt-0 last:mb-0">
          {renderInline(block.text, citations, index, fullText)}
        </p>
      );
  }
}

function renderInline(
  text: string,
  citations: Citation[],
  index: Map<string, { citation: Citation; number: number }>,
  fullText: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  CITATION_REGEX.lastIndex = 0;
  for (const match of text.matchAll(CITATION_REGEX)) {
    const [fullMatch, rawFile, rawChunk] = match;
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(renderBoldAndCode(text.slice(cursor, start), key++));
    }

    const filename = rawFile.trim();
    const chunkNum = rawChunk ? parseInt(rawChunk, 10) - 1 : null;
    let citation: Citation | undefined;
    let number: number | undefined;

    if (chunkNum !== null) {
      const found = index.get(citationKey(filename, chunkNum));
      if (found) {
        citation = found.citation;
        number = found.number;
      }
    }
    if (!citation) {
      // Fallback: match on filename only
      const found = citations.find((c) =>
        c.filename.toLowerCase().includes(filename.toLowerCase()) ||
        filename.toLowerCase().includes(c.filename.toLowerCase().replace(/\.[^/.]+$/, '')),
      );
      if (found) {
        const key2 = citationKey(found.filename, found.chunkIndex);
        const existing = index.get(key2);
        if (existing) {
          citation = existing.citation;
          number = existing.number;
        }
      }
    }

    if (citation && number !== undefined) {
      const globalPos = fullText.indexOf(fullMatch);
      const claimText = globalPos >= 0 ? extractClaimSentence(fullText, globalPos) : text;
      nodes.push(
        <CitationChip
          key={key++}
          citation={citation}
          index={number}
          claimText={claimText}
        />,
      );
    } else {
      nodes.push(<span key={key++} className="text-ink-400 text-[11px]">{fullMatch}</span>);
    }

    cursor = start + fullMatch.length;
  }

  if (cursor < text.length) {
    nodes.push(renderBoldAndCode(text.slice(cursor), key++));
  }

  return nodes;
}

function renderBoldAndCode(text: string, key: number): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  let i = 0;
  for (const m of text.matchAll(regex)) {
    const start = m.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));
    const token = m[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${key}-${i++}`} className="font-bold text-ink-900">{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={`${key}-${i++}`}
          className="px-1.5 py-0.5 rounded bg-ink-100 text-[12px] font-mono text-brand-700"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <span key={key}>{parts}</span>;
}
