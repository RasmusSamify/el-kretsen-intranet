import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  EyeOff,
  FileText,
  FileX,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { correctionAction, type CorrectionType } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type CorrectionStatus = 'pending' | 'resolved' | 'ignored';

interface CorrectionRow {
  id: string;
  question: string;
  original_answer: string;
  correction_type: CorrectionType;
  cited_source: string | null;
  suggested_source: string | null;
  user_note: string | null;
  status: CorrectionStatus;
  created_at: string;
}

const TYPE_META: Record<CorrectionType, { label: string; tone: string; help: string; icon: typeof FileX }> = {
  wrong_source: {
    label: 'Fel källa hänvisades',
    tone: 'bg-amber-50 border-amber-200 text-amber-900',
    help: 'ELvis citerade fel dokument. Rätt källa föreslagen nedan.',
    icon: FileX,
  },
  outdated_source: {
    label: 'Källan är inaktuell',
    tone: 'bg-orange-50 border-orange-200 text-orange-900',
    help: 'Källan ELvis citerade behöver uppdateras eller markeras inaktuell.',
    icon: AlertCircle,
  },
  missing_in_kb: {
    label: 'Saknas i kunskapsbasen',
    tone: 'bg-blue-50 border-blue-200 text-blue-900',
    help: 'Svaret finns inte i kunskapsbasen. Ett dokument behöver läggas till.',
    icon: FileText,
  },
};

export function CorrectionsList() {
  const [items, setItems] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<CorrectionStatus | 'all'>('pending');

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    supabase
      .from('ai_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!mounted) return;
        setItems((data ?? []) as CorrectionRow[]);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const filtered = statusFilter === 'all' ? items : items.filter((r) => r.status === statusFilter);

  const act = async (row: CorrectionRow, action: 'resolve' | 'ignore' | 'reopen') => {
    setActioning(row.id);
    try {
      await correctionAction(row.id, action);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setActioning(null);
    }
  };

  const stats = {
    total: items.length,
    pending: items.filter((r) => r.status === 'pending').length,
    resolved: items.filter((r) => r.status === 'resolved').length,
    ignored: items.filter((r) => r.status === 'ignored').length,
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatPill label="Totalt" value={stats.total} />
        <StatPill label="Att granska" value={stats.pending} highlight={stats.pending > 0} />
        <StatPill label="Åtgärdade" value={stats.resolved} />
        <StatPill label="Ignorerade" value={stats.ignored} />
      </div>

      <Card variant="glass" className="p-6 flex flex-col min-h-[420px]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1">
            <h2 className="font-bold text-ink-900 text-[15px] leading-none">
              {filtered.length} {filtered.length === 1 ? 'rättelse' : 'rättelser'}
            </h2>
            <p className="text-[11px] font-semibold text-ink-400 mt-1">
              Linnea och teamet kan skicka in rättelser direkt från ELvis-chatten
            </p>
          </div>
          <SegmentedControl
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as CorrectionStatus | 'all')}
            options={[
              { value: 'pending', label: 'Att granska' },
              { value: 'resolved', label: 'Åtgärdade' },
              { value: 'ignored', label: 'Ignorerade' },
              { value: 'all', label: 'Alla' },
            ]}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={22} className="text-brand-500" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
        ) : (
          <ul className="flex-1 space-y-3 overflow-y-auto -mx-1 px-1">
            {filtered.map((row) => (
              <CorrectionCard
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
  );
}

function CorrectionCard({
  row,
  actioning,
  onAction,
}: {
  row: CorrectionRow;
  actioning: boolean;
  onAction: (row: CorrectionRow, action: 'resolve' | 'ignore' | 'reopen') => void;
}) {
  const meta = TYPE_META[row.correction_type];
  const Icon = meta.icon;
  const isPending = row.status === 'pending';

  return (
    <li className="rounded-2xl border border-ink-100 bg-white overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3 flex-wrap border-b border-ink-100">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border',
            meta.tone,
          )}
        >
          <Icon size={11} strokeWidth={2.5} />
          {meta.label}
        </span>

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

      <div className="px-5 py-3 bg-white/60 border-b border-ink-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1.5 inline-flex items-center gap-1.5">
          <Sparkles size={11} strokeWidth={2} />
          Fråga
        </p>
        <p className="text-[13px] text-ink-800 leading-relaxed">{row.question}</p>
      </div>

      {(row.cited_source || row.suggested_source) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-ink-100 bg-white">
          {row.cited_source && (
            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
                Hänvisades fel / inaktuell
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-100 text-red-700 text-[11px] font-bold">
                <FileText size={10} strokeWidth={2} />
                {row.cited_source.replace(/\.[^/.]+$/, '')}
              </span>
            </div>
          )}
          {row.suggested_source && (
            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
                Föreslagen rätt källa
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold">
                <FileText size={10} strokeWidth={2} />
                {row.suggested_source.replace(/\.[^/.]+$/, '')}
              </span>
            </div>
          )}
        </div>
      )}

      {row.user_note && (
        <div className="px-5 py-3 bg-ink-50/40 border-t border-ink-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">Kommentar</p>
          <p className="text-[12.5px] text-ink-700 leading-relaxed italic">{row.user_note}</p>
        </div>
      )}

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

function StatPill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
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

function EmptyState({ statusFilter }: { statusFilter: CorrectionStatus | 'all' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
      <ChevronRight size={36} strokeWidth={1.25} className="text-ink-400 mb-4 rotate-90" />
      <h3 className="text-display text-xl text-ink-900">
        {statusFilter === 'pending' ? 'Inga rättelser att granska' : 'Inga rättelser här'}
      </h3>
      <p className="text-[13px] text-ink-500 max-w-sm leading-relaxed mt-2">
        Linnea och teamet kan skicka in rättelser direkt via "Rätta detta svar"-knappen i ELvis-chatten
        — de dyker upp här för admin att följa upp.
      </p>
    </div>
  );
}
