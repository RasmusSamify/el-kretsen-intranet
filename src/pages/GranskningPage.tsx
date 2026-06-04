import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  EyeOff,
  FileText,
  Info,
  Moon,
  RefreshCw,
  Search,
  Sparkles,
  Undo2,
  UserCheck,
  X,
} from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cn, formatDate } from '@/lib/utils';
import { CorrectionsList } from '@/components/features/kb/CorrectionsList';
import { GapsView } from '@/components/features/kb/GapsView';

type GranskningView = 'contradictions' | 'corrections' | 'gaps';

type ReviewStatus = 'pending' | 'resolved' | 'ignored';

interface ReviewRow {
  id: string;
  chunk_a_id: string;
  chunk_b_id: string;
  issue_type: string;
  severity: number;
  similarity: number | null;
  ai_reasoning: string | null;
  status: ReviewStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  chunk_a: ChunkDetails | null;
  chunk_b: ChunkDetails | null;
}

interface ChunkDetails {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
}

interface Filters {
  status: ReviewStatus | 'all';
  severity: number | 'all';
  filename: string;
}

const SEVERITY_TONES: Record<number, { bg: string; text: string; label: string }> = {
  5: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Kritisk' },
  4: { bg: 'bg-red-50/60 border-red-100', text: 'text-red-700', label: 'Hög' },
  3: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'Medel' },
  2: { bg: 'bg-amber-50/60 border-amber-100', text: 'text-amber-700', label: 'Låg' },
  1: { bg: 'bg-ink-100 border-ink-200', text: 'text-ink-600', label: 'Marginell' },
};

export function GranskningPage() {
  const [view, setView] = useState<GranskningView>('contradictions');
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: 'pending',
    severity: 'all',
    filename: '',
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      // Läs review-raderna först, hämta sen de refererade chunks separat
      const { data: reviewData, error } = await supabase
        .from('kb_review_queue')
        .select('*')
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (!mounted) return;
      if (error || !reviewData) {
        setItems([]);
        setLoading(false);
        return;
      }

      const chunkIds = Array.from(
        new Set(reviewData.flatMap((r) => [r.chunk_a_id, r.chunk_b_id])),
      );
      const { data: chunkData } = await supabase
        .from('kb_chunks_v2')
        .select('id, filename, chunk_index, text')
        .in('id', chunkIds);

      const byId = new Map<string, ChunkDetails>();
      for (const c of chunkData ?? []) byId.set(c.id, c as ChunkDetails);

      const merged: ReviewRow[] = reviewData.map((r) => ({
        ...(r as Omit<ReviewRow, 'chunk_a' | 'chunk_b'>),
        chunk_a: byId.get(r.chunk_a_id) ?? null,
        chunk_b: byId.get(r.chunk_b_id) ?? null,
      }));
      setItems(merged);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.severity !== 'all' && r.severity !== filters.severity) return false;
      if (filters.filename) {
        const q = filters.filename.toLowerCase();
        const aMatch = r.chunk_a?.filename.toLowerCase().includes(q) ?? false;
        const bMatch = r.chunk_b?.filename.toLowerCase().includes(q) ?? false;
        if (!aMatch && !bMatch) return false;
      }
      return true;
    });
  }, [items, filters]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((r) => r.status === 'pending').length,
      resolved: items.filter((r) => r.status === 'resolved').length,
      ignored: items.filter((r) => r.status === 'ignored').length,
      critical: items.filter((r) => r.severity >= 4 && r.status === 'pending').length,
    };
  }, [items]);

  const act = async (review: ReviewRow, action: 'resolve' | 'ignore' | 'reopen') => {
    setActioning(review.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Ingen aktiv session — logga in igen');
      }
      const res = await fetch('/api/review-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ review_id: review.id, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AlertTriangle size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Granskning</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Motsägelser mellan chunks i kunskapsbasen · AI-detekterade par att granska manuellt
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} strokeWidth={1.75} />
            <span>{view === 'contradictions' ? 'Nattlig audit' : 'Användarrättelser'}</span>
          </div>
        </header>

        {/* Top tabs */}
        <div className="flex">
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as GranskningView)}
            options={[
              { value: 'contradictions', label: 'Motsägelser (audit)' },
              { value: 'corrections', label: 'Användarrättelser' },
              { value: 'gaps', label: 'Kunskapsluckor' },
            ]}
          />
        </div>

        {view !== 'gaps' && <GranskningExplainer view={view} />}

        {view === 'gaps' && <GapsView />}

        {view === 'corrections' && <CorrectionsList />}

        {view === 'contradictions' && (
          <>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatPill label="Totalt" value={stats.total} />
          <StatPill label="Att granska" value={stats.pending} highlight={stats.pending > 0} />
          <StatPill label="Kritiska (sev 4-5)" value={stats.critical} highlight={stats.critical > 0} />
          <StatPill label="Åtgärdade" value={stats.resolved} />
          <StatPill label="Ignorerade" value={stats.ignored} />
        </div>

        {/* Filter + lista */}
        <Card variant="glass" className="p-6 flex flex-col min-h-[520px]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex-1">
              <h2 className="font-bold text-ink-900 text-[15px] leading-none">
                {filtered.length} {filtered.length === 1 ? 'ärende' : 'ärenden'}
              </h2>
              <p className="text-[11px] font-semibold text-ink-400 mt-1">
                Sorterat på severity, senaste först
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} strokeWidth={1.75} />}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Uppdatera
            </Button>
          </div>

          {/* Filter */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <SegmentedControl
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v as ReviewStatus | 'all' }))}
              options={[
                { value: 'pending', label: 'Att granska' },
                { value: 'resolved', label: 'Åtgärdade' },
                { value: 'ignored', label: 'Ignorerade' },
                { value: 'all', label: 'Alla' },
              ]}
            />
            <SegmentedControl
              value={String(filters.severity)}
              onChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  severity: v === 'all' ? 'all' : (parseInt(v) as number),
                }))
              }
              options={[
                { value: 'all', label: 'Alla severity' },
                { value: '5', label: '5' },
                { value: '4', label: '4' },
                { value: '3', label: '3' },
                { value: '2', label: '2' },
                { value: '1', label: '1' },
              ]}
            />
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={filters.filename}
                onChange={(e) => setFilters((f) => ({ ...f, filename: e.target.value }))}
                placeholder="Filtrera på filnamn…"
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-white border border-ink-200 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all"
              />
              {filters.filename && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, filename: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size={22} className="text-brand-500" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filters={filters} />
          ) : (
            <ul className="flex-1 space-y-3 overflow-y-auto -mx-1 px-1">
              {filtered.map((row) => (
                <ReviewCard
                  key={row.id}
                  row={row}
                  actioning={actioning === row.id}
                  onAction={act}
                />
              ))}
            </ul>
          )}
        </Card>
          </>
        )}
      </div>
    </div>
  );
}

const EXPLAINER_STORAGE_KEY = 'granskning-explainer-open';

function GranskningExplainer({ view }: { view: GranskningView }) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(EXPLAINER_STORAGE_KEY) !== 'false';
  });

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(EXPLAINER_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <Card variant="glass" className="overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-ink-50/50 transition-colors"
        aria-expanded={open}
      >
        <span className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 inline-flex items-center justify-center shrink-0">
          <Info size={16} strokeWidth={2} className="text-brand-600" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink-900 text-[14px] leading-none">Så funkar granskningen</h3>
          <p className="text-[11.5px] font-semibold text-ink-400 mt-1">
            Vad de här ärendena är, var de kommer ifrån och hur du hanterar dem
          </p>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={cn('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-ink-100 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
            <ExplainerBlock
              icon={<Moon size={15} strokeWidth={2} />}
              tone="brand"
              active={view === 'contradictions'}
              title="Motsägelser (nattlig audit)"
            >
              När du <strong>lägger till eller ändrar en källa</strong> kontrolleras den direkt mot
              resten av kunskapsbasen — säger den emot något befintligt dyker paret upp här inom
              minuter. Utöver det går ett automatiskt jobb varje natt (03:15) igenom hela basen i
              omgångar och fångar äldre kombinationer som glidit isär. Båda plockar stycken som{' '}
              <strong>liknar varandra men inte är identiska</strong> och låter AI:n (Claude) avgöra
              om de faktiskt <strong>säger emot varandra</strong> — t.ex. två olika datum eller
              avgifter för samma sak. Hittade par hamnar här med en <strong>severity 1–5</strong>{' '}
              (5 = kritisk) och AI:ns motivering. Nattsvepets fulla varv tar ett par veckor, sen
              börjar det om.
            </ExplainerBlock>

            <ExplainerBlock
              icon={<UserCheck size={15} strokeWidth={2} />}
              tone="amber"
              active={view === 'corrections'}
              title="Användarrättelser"
            >
              När en medarbetare läser ett ELvis-svar och tycker att det pekar på{' '}
              <strong>fel källa</strong>, en <strong>föråldrad källa</strong> eller att svaret{' '}
              <strong>saknas i kunskapsbasen</strong>, kan hen flagga det direkt i chatten. De
              flaggorna samlas här så att du kan följa upp och rätta källan.
            </ExplainerBlock>
          </div>

          <div className="rounded-xl bg-ink-50/70 border border-ink-100 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-ink-500 mb-1.5">
              Vad du gör här
            </p>
            <ul className="text-[12.5px] text-ink-700 leading-relaxed space-y-1">
              <li className="flex items-start gap-2">
                <Check size={13} strokeWidth={2.5} className="text-emerald-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Åtgärdad</strong> — du har rättat texten i Kunskapsbasen så att
                  motsägelsen är borta.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <EyeOff size={13} strokeWidth={2.5} className="text-ink-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Ignorera</strong> — paret är inte en riktig motsägelse (t.ex. två giltiga
                  fall som bara liknar varandra). Försvinner från listan men kan öppnas igen.
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function ExplainerBlock({
  icon,
  tone,
  active,
  title,
  children,
}: {
  icon: ReactNode;
  tone: 'brand' | 'amber';
  active: boolean;
  title: string;
  children: ReactNode;
}) {
  const toneCls =
    tone === 'brand'
      ? 'bg-brand-50 border-brand-100 text-brand-600'
      : 'bg-amber-50 border-amber-100 text-amber-600';
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        active ? 'border-ink-200 bg-white shadow-card' : 'border-ink-100 bg-white/50',
      )}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className={cn('w-8 h-8 rounded-lg inline-flex items-center justify-center border', toneCls)}>
          {icon}
        </span>
        <h4 className="font-bold text-ink-900 text-[13px] leading-tight">{title}</h4>
        {active && (
          <span className="ml-auto text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-ink-900 text-white">
            Visas nu
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-ink-600 leading-relaxed">{children}</p>
    </div>
  );
}

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card
      variant="glass"
      className={cn('p-4', highlight && value > 0 && 'border-amber-200 bg-amber-50/40')}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="text-display text-3xl text-ink-900 tabular-nums leading-none mt-2">
        {value.toLocaleString('sv-SE')}
      </p>
    </Card>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-ink-100/60 border border-ink-100 shadow-inner-soft">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition-all whitespace-nowrap',
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ReviewCard({
  row,
  actioning,
  onAction,
}: {
  row: ReviewRow;
  actioning: boolean;
  onAction: (row: ReviewRow, action: 'resolve' | 'ignore' | 'reopen') => void;
}) {
  const tone = SEVERITY_TONES[row.severity] ?? SEVERITY_TONES[3];
  const isPending = row.status === 'pending';

  return (
    <li className={cn('rounded-2xl border bg-white overflow-hidden', tone.bg)}>
      <div className="px-5 py-4 flex items-center gap-3 flex-wrap border-b border-ink-100">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
            tone.bg,
            tone.text,
          )}
        >
          <AlertTriangle size={11} strokeWidth={2.5} />
          Severity {row.severity} · {tone.label}
        </span>

        {row.issue_type === 'drift' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
            Drift · Intern vs lag
          </span>
        )}

        {row.similarity != null && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
            Likhet {(Number(row.similarity) * 100).toFixed(1)} %
          </span>
        )}

        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 inline-flex items-center gap-1">
          <Clock size={11} strokeWidth={2} />
          {formatDate(row.created_at, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {row.status === 'resolved' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              <Check size={11} strokeWidth={2.5} />
              Åtgärdat
            </span>
          )}
          {row.status === 'ignored' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 text-ink-600 text-[10px] font-black uppercase tracking-wider">
              <EyeOff size={11} strokeWidth={2.5} />
              Ignorerat
            </span>
          )}
        </div>
      </div>

      {row.ai_reasoning && (
        <div className="px-5 py-3 bg-white/60 border-b border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5 inline-flex items-center gap-1.5">
            <Sparkles size={11} strokeWidth={2} />
            AI-resonemang
          </p>
          <p className="text-[13px] text-ink-800 leading-relaxed">{row.ai_reasoning}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-ink-100 bg-white">
        <ChunkPanel chunk={row.chunk_a} label="Stycke A" />
        <ChunkPanel chunk={row.chunk_b} label="Stycke B" />
      </div>

      <div className="px-5 py-3 bg-white border-t border-ink-100 flex items-center gap-2 flex-wrap">
        {isPending ? (
          <>
            <Button
              size="sm"
              leftIcon={<Check size={14} strokeWidth={2} />}
              onClick={() => onAction(row, 'resolve')}
              disabled={actioning}
            >
              Åtgärdad
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<EyeOff size={14} strokeWidth={1.75} />}
              onClick={() => onAction(row, 'ignore')}
              disabled={actioning}
            >
              Ignorera
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Undo2 size={14} strokeWidth={1.75} />}
            onClick={() => onAction(row, 'reopen')}
            disabled={actioning}
          >
            Öppna igen
          </Button>
        )}
        {actioning && <Spinner size={14} className="text-ink-500" />}
      </div>
    </li>
  );
}

function ChunkPanel({ chunk, label }: { chunk: ChunkDetails | null; label: string }) {
  if (!chunk) {
    return (
      <div className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
        <p className="text-[12px] text-ink-400 mt-2 italic">Chunk borttaget sedan audit kördes</p>
      </div>
    );
  }
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-100 text-ink-700 text-[10px] font-bold">
          <FileText size={10} strokeWidth={2} />
          {chunk.filename.replace(/\.[^/.]+$/, '')} · stycke {chunk.chunk_index + 1}
        </span>
        <a
          href={`/kunskapsbas?filename=${encodeURIComponent(chunk.filename)}`}
          className="ml-auto text-ink-400 hover:text-ink-900 transition-colors"
          title="Öppna källan i Kunskapsbas"
        >
          <ExternalLink size={12} strokeWidth={1.75} />
        </a>
      </div>
      <p className="text-[12.5px] text-ink-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
        {chunk.text}
      </p>
    </div>
  );
}

function EmptyState({ filters }: { filters: Filters }) {
  const activeFilter =
    filters.status !== 'pending' || filters.severity !== 'all' || filters.filename;
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
      <ChevronRight size={36} strokeWidth={1.25} className="text-ink-400 mb-4 rotate-90" />
      <h3 className="text-display text-xl text-ink-900">
        {activeFilter ? 'Inga ärenden matchar filtret' : 'Inga motsägelser hittade'}
      </h3>
      <p className="text-[13px] text-ink-500 max-w-sm leading-relaxed mt-2">
        {activeFilter
          ? 'Justera filtren ovan för att se andra ärenden.'
          : 'Nattlig audit skannar kunskapsbasen. Ärenden dyker upp här när AI:n hittar chunks som säger emot varandra.'}
      </p>
    </div>
  );
}
