import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleHelp,
  FileText,
  Lightbulb,
  Sparkles,
  TriangleAlert,
  Wand2,
  X,
} from 'lucide-react';
import { Button, Card, IconTile, Modal, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';
import { cn, formatDate } from '@/lib/utils';
import { commitGap, dismissGap, draftGap, type GapDraft } from '@/lib/api';

interface GapRow {
  id: string;
  question_text: string;
  outcome: 'unanswered' | 'partial' | 'error';
  gaps_text: string | null;
  top_match_filename: string | null;
  top_match_similarity: number | null;
  created_at: string;
}

export function GapsView() {
  const { isAdmin } = useAdmin();
  const [rows, setRows] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<GapRow | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_unanswered')
      .select('id, question_text, outcome, gaps_text, top_match_filename, top_match_similarity, created_at')
      .eq('gap_status', 'open')
      .in('outcome', ['unanswered', 'partial'])
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data ?? []) as GapRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const dismiss = async (row: GapRow) => {
    setActing(row.id);
    try {
      await dismissGap(row.id);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={22} className="text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card variant="glass" className="p-5">
        <div className="flex items-start gap-3">
          <IconTile icon={<Lightbulb size={14} strokeWidth={2.25} />} tone="warning" size="sm" />
          <div className="flex-1">
            <h2 className="font-bold text-ink-900 text-[15px] leading-none">
              Öppna kunskapsluckor ({rows.length})
            </h2>
            <p className="text-[12px] font-semibold text-ink-400 mt-1.5 leading-relaxed">
              Frågor ELvis inte kunde besvara fullt. Skapa ett AI-utkast grundat i befintlig
              kunskapsbas, verifiera mot källa, och lägg till det — så stängs luckan.
              {!isAdmin && ' Endast admin kan skapa utkast och lägga till källor.'}
            </p>
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card variant="glass" className="p-12 text-center">
          <IconTile icon={<CheckCircle2 size={20} strokeWidth={2} />} tone="success" size="lg" />
          <h3 className="text-display text-2xl text-ink-900 mt-4 mb-2">Inga öppna luckor</h3>
          <p className="text-[13px] text-ink-500 max-w-md mx-auto leading-relaxed">
            ELvis klarar alla frågor med nuvarande kunskapsbas. Nya luckor dyker upp här när någon
            ställer en fråga som inte kan besvaras.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card variant="glass" className="p-5">
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className={cn(
                      'shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border',
                      row.outcome === 'partial'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-red-100 text-red-800 border-red-200',
                    )}
                  >
                    {row.outcome === 'partial' ? 'Delvis' : 'Obesvarad'}
                  </span>
                  <p className="flex-1 min-w-0 text-[14px] font-semibold text-ink-900 leading-snug">
                    {row.question_text}
                  </p>
                </div>

                {row.outcome === 'partial' && row.gaps_text && (
                  <p className="mt-2.5 text-[12px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                    {row.gaps_text}
                  </p>
                )}

                <div className="mt-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 flex-wrap">
                  <CircleHelp size={11} strokeWidth={2} />
                  <span>
                    {formatDate(row.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {row.top_match_similarity != null && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>närmast i KB: {Math.round(row.top_match_similarity * 100)} %</span>
                    </>
                  )}
                  {row.top_match_filename && (
                    <span className="truncate max-w-[240px] normal-case tracking-normal text-ink-500">
                      {row.top_match_filename}
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <div className="mt-3.5 pt-3 border-t border-ink-100 flex items-center gap-2">
                    <Button
                      size="sm"
                      leftIcon={<Wand2 size={14} strokeWidth={2} />}
                      onClick={() => setActive(row)}
                    >
                      Skapa utkast
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<X size={14} strokeWidth={2} />}
                      onClick={() => dismiss(row)}
                      disabled={acting === row.id}
                    >
                      Avfärda
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <GapDraftModal
          gap={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GapDraftModal({
  gap,
  onClose,
  onDone,
}: {
  gap: GapRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'drafting' | 'ready' | 'saving'>('drafting');
  const [draft, setDraft] = useState<GapDraft | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setPhase('drafting');
    setError(null);
    try {
      const d = await draftGap(gap.question_text, gap.gaps_text);
      setDraft(d);
      setTitle(d.title || gap.question_text.slice(0, 60));
      setContent(d.draft);
      setPhase('ready');
    } catch (e) {
      setError((e as Error).message);
      setPhase('ready');
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (content.trim().length < 50 || !title.trim()) return;
    setPhase('saving');
    setError(null);
    try {
      await commitGap(gap.id, title.trim(), content);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setPhase('ready');
    }
  };

  return (
    <Modal open onClose={phase === 'saving' ? () => {} : onClose} title="Skapa kunskapskälla från lucka" size="2xl">
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="p-3 rounded-xl bg-ink-50 border border-ink-100">
          <p className="text-[10px] font-black uppercase tracking-wider text-ink-400 mb-1">Frågan som saknade svar</p>
          <p className="text-[13px] font-semibold text-ink-800 leading-snug">{gap.question_text}</p>
        </div>

        {phase === 'drafting' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Spinner size={30} className="text-brand-500 mb-4" />
            <p className="text-display text-lg text-ink-900">AI:n skriver ett utkast…</p>
            <p className="text-[12px] text-ink-500 mt-1.5">
              Söker i befintlig kunskapsbas · markerar det som behöver kompletteras
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <TriangleAlert size={15} className="text-amber-700 shrink-0 mt-0.5" strokeWidth={2.25} />
              <p className="text-[12px] text-amber-900 leading-relaxed">
                <strong>AI-utkast grundat i befintlig kunskapsbas.</strong> Verifiera alla fakta och
                fyll i <code className="font-mono text-[11px]">[ATT KOMPLETTERA: …]</code>-platshållare
                mot källa innan du lägger till. AI:n hittar inte på siffror, datum eller paragrafer.
              </p>
            </div>

            {draft && draft.needs.length > 0 && (
              <div className="p-3 rounded-xl bg-white border border-ink-200">
                <p className="text-[10px] font-black uppercase tracking-wider text-ink-500 mb-1.5 inline-flex items-center gap-1.5">
                  <Sparkles size={12} strokeWidth={2.25} />
                  AI:n flaggar att detta bör verifieras/kompletteras
                </p>
                <ul className="space-y-1">
                  {draft.needs.map((n, i) => (
                    <li key={i} className="text-[12.5px] text-ink-700 flex items-start gap-2 leading-snug">
                      <span className="text-amber-600 mt-1">•</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                Titel / filnamn på källan
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-ink-200 text-[13px] font-semibold text-ink-900 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all"
                placeholder="t.ex. Insamlingsmål bärbara batterier 2026"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-1.5">
                Innehåll (redigera fritt innan du lägger till)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full p-3.5 rounded-xl bg-white border border-ink-200 text-[13px] text-ink-800 leading-relaxed focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all resize-y font-mono"
              />
            </div>

            {draft && draft.usedSources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 inline-flex items-center gap-1">
                  <FileText size={11} strokeWidth={2} /> Byggde på
                </span>
                {draft.usedSources.slice(0, 5).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-ink-50 border border-ink-100 text-[10.5px] font-semibold text-ink-600 truncate max-w-[200px]"
                  >
                    {s.replace(/\.[^/.]+$/, '')}
                  </span>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[12.5px] text-red-700 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-ink-100 bg-ink-50/40">
        <Button variant="ghost" onClick={onClose} disabled={phase === 'saving'}>
          Avbryt
        </Button>
        <div className="flex items-center gap-2">
          {phase !== 'drafting' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Wand2 size={14} strokeWidth={2} />}
              onClick={generate}
              disabled={phase === 'saving'}
            >
              Gör om utkast
            </Button>
          )}
          <Button
            onClick={save}
            loading={phase === 'saving'}
            disabled={phase === 'drafting' || content.trim().length < 50 || !title.trim()}
            leftIcon={<CheckCircle2 size={16} strokeWidth={2.25} />}
          >
            Godkänn & lägg till i kunskapsbas
          </Button>
        </div>
      </div>
    </Modal>
  );
}
