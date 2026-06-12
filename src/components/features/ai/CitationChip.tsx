import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Sparkles, X } from 'lucide-react';
import type { Citation } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  findBestMatchSentence,
  snippetAround,
  splitSentences,
  type Sentence,
} from '@/lib/chunkHighlight';
import { buildSourceUrl } from '@/lib/sourceLink';

interface CitationChipProps {
  citation: Citation;
  index: number;
  claimText?: string;
}

interface PopoverPosition {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

const POPOVER_WIDTH = 420;
const VIEWPORT_MARGIN = 8;

export function CitationChip({ citation, index, claimText }: CitationChipProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Mätsteget körs via useLayoutEffect så popovern kan positioneras innan
  // browsern målar — undviker flicker. Vi flyttar rutan i portal till body,
  // vilket gör att overflow-clip på chat-containern inte längre kan skära av den.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const compute = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: 'above' | 'below' =
        spaceAbove >= 280 || spaceAbove >= spaceBelow ? 'above' : 'below';

      const desiredLeft = rect.left + rect.width / 2 - POPOVER_WIDTH * 0.35;
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN, desiredLeft),
      );
      const top = placement === 'above' ? rect.top - VIEWPORT_MARGIN : rect.bottom + VIEWPORT_MARGIN;
      setPos({ top, left, placement });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open]);

  // Click-outside-handler måste inkludera popoverns nya hem i document.body.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setPos(null);
    }
  }, [open]);

  const highlight = useMemo<Sentence | null>(() => {
    if (!claimText) return null;
    return findBestMatchSentence(citation.text, claimText);
  }, [citation.text, claimText]);

  // Djuplänk till källan: webbsidor öppnas vid rätt avsnitt via text-fragment
  // (bygger på den mest relevanta meningen, annars chunkens första mening).
  // Interna dokument saknar publik URL → null.
  const sourceUrl = useMemo(() => {
    const snippet = highlight?.text ?? splitSentences(citation.text)[0]?.text ?? null;
    return buildSourceUrl(citation.filename, snippet);
  }, [citation.filename, citation.text, highlight]);

  const displayName = citation.filename.replace(/\.[^/.]+$/, '');

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full align-baseline',
          'text-[11px] font-bold',
          'bg-brand-50 text-brand-700 border border-brand-100',
          'hover:bg-brand-100 hover:border-brand-200 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        )}
        title={`${displayName} · stycke ${citation.chunkIndex + 1}`}
      >
        <FileText size={10} strokeWidth={2.5} />
        <span>{index}</span>
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: pos.placement === 'above' ? 'translateY(-100%)' : undefined,
              width: POPOVER_WIDTH,
              maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
              zIndex: 60,
            }}
            className="animate-fade-in"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-ink-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-ink-100 bg-ink-50">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-brand-500 shrink-0" strokeWidth={2.25} />
                  <span className="text-xs font-bold text-ink-800 truncate">{displayName}</span>
                  <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider shrink-0">
                    · stycke {citation.chunkIndex + 1}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="text-ink-400 hover:text-ink-700 transition-colors"
                  aria-label="Stäng"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>

              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="group/link flex items-center justify-between gap-2 px-4 py-2.5 bg-brand-50 hover:bg-brand-100 transition-colors border-b border-brand-100"
                >
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-bold text-brand-700 truncate">
                      Öppna källan{highlight ? ' vid rätt avsnitt' : ''}
                    </span>
                    {highlight && (
                      <span className="block text-[10px] font-semibold text-brand-500/80">
                        Hoppa till avsnitt funkar bäst i Chrome eller Edge
                      </span>
                    )}
                  </span>
                  <ExternalLink
                    size={13}
                    strokeWidth={2.25}
                    className="text-brand-500 group-hover/link:text-brand-700 transition-colors shrink-0"
                  />
                </a>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-ink-50 border-b border-ink-100">
                  <FileText size={12} strokeWidth={2} className="text-ink-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-ink-500">
                    Internt dokument · avsnittet visas nedan
                  </span>
                </div>
              )}

              {highlight && !expanded ? (
                <SnippetView citation={citation} highlight={highlight} />
              ) : (
                <FullChunkView citation={citation} highlight={highlight} />
              )}

              {highlight && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((v) => !v);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900 hover:bg-ink-50 transition-colors border-t border-ink-100"
                >
                  {expanded ? (
                    <>
                      <ChevronUp size={12} strokeWidth={2} />
                      Visa bara relevant del
                    </>
                  ) : (
                    <>
                      <ChevronDown size={12} strokeWidth={2} />
                      Visa hela stycket ({citation.text.length.toLocaleString('sv-SE')} tecken)
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                <div className="flex items-center gap-2">
                  <span>Relevans: {Math.round(citation.similarity * 100)} %</span>
                  {citation.text.length >= 1800 && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 normal-case tracking-normal text-[9px] font-bold border border-brand-100"
                      title="v1.5: hierarkisk sök returnerar hela parent-stycket åt ELvis för bättre kontext"
                    >
                      <Sparkles size={9} strokeWidth={2.25} />
                      Stor kontext · {citation.text.length.toLocaleString('sv-SE')} tecken
                    </span>
                  )}
                </div>
                {highlight && (
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal shrink-0">
                    <Sparkles size={10} strokeWidth={2} className="text-amber-600" />
                    <span className="text-amber-700">Gul = mest relevant</span>
                  </span>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function SnippetView({ citation, highlight }: { citation: Citation; highlight: Sentence }) {
  const snip = snippetAround(citation.text, highlight, 140);
  return (
    <div className="p-4 text-[12.5px] text-ink-700 leading-relaxed">
      {snip.trimmedStart && <span className="text-ink-400">…</span>}
      {snip.before}
      <Mark>{snip.highlight}</Mark>
      {snip.after}
      {snip.trimmedEnd && <span className="text-ink-400">…</span>}
    </div>
  );
}

function FullChunkView({
  citation,
  highlight,
}: {
  citation: Citation;
  highlight: Sentence | null;
}) {
  const content: ReactNode = useMemo(() => {
    if (!highlight) return citation.text;
    return (
      <>
        {citation.text.slice(0, highlight.start)}
        <Mark>{citation.text.slice(highlight.start, highlight.end)}</Mark>
        {citation.text.slice(highlight.end)}
      </>
    );
  }, [citation.text, highlight]);

  return (
    <div className="p-4 text-[12.5px] text-ink-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
      {content}
    </div>
  );
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <mark className="bg-amber-100 text-ink-900 rounded-sm px-0.5 -mx-0.5 border border-amber-200/60">
      {children}
    </mark>
  );
}
