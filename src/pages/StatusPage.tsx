import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Library,
  RefreshCw,
  ScanSearch,
  ServerCog,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button, Card, IconTile, Spinner } from '@/components/ui';
import {
  runAuditBatch,
  runDriftBatch,
  systemStatus,
  triggerCrawl,
  type SystemStatusResponse,
} from '@/lib/api';
import { useAdmin } from '@/hooks/useAdmin';
import { cn, formatDate } from '@/lib/utils';

function relativeTime(iso: string | null): string {
  if (!iso) return 'aldrig';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('sv-SE', { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, 'day');
  const months = Math.round(days / 30);
  return rtf.format(-months, 'month');
}

function fullDate(iso: string | null): string {
  if (!iso) return '—';
  return formatDate(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SERVICE_ICONS: Record<string, ReactNode> = {
  supabase: <Database size={15} strokeWidth={2} />,
  anthropic: <Zap size={15} strokeWidth={2} />,
  voyage: <ScanSearch size={15} strokeWidth={2} />,
  netlify: <ServerCog size={15} strokeWidth={2} />,
};

export function StatusPage() {
  const { isAdmin } = useAdmin();
  const [data, setData] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await systemStatus());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={28} className="text-brand-500" />
      </div>
    );
  }

  const services = data?.services ?? [];
  const allOk = services.every((s) => s.ok);
  const downCount = services.filter((s) => !s.ok).length;
  const facts = data?.facts;

  const crawl = facts?.crawl;
  const crawlLastCompleted =
    crawl?.last_completed?.completed_at ?? crawl?.fallback_last_website_update ?? null;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Activity size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Systemstatus</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Live-koll av tjänster · när kunskapsbasen, crawlen och granskningen senast kördes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="text-[11px] font-semibold text-ink-400 tabular-nums hidden sm:inline">
                Kollad {fullDate(data.checked_at)}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} strokeWidth={1.75} className={cn(loading && 'animate-spin')} />}
              onClick={load}
              disabled={loading}
            >
              Uppdatera
            </Button>
          </div>
        </header>

        {error && (
          <Card variant="glass" className="p-5 border-red-200 bg-red-50/40">
            <p className="text-[13px] text-red-700 font-medium">Kunde inte hämta status: {error}</p>
          </Card>
        )}

        {/* Overall banner */}
        <Card
          variant="glass"
          className={cn(
            'p-6 border',
            allOk ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40',
          )}
        >
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'w-12 h-12 rounded-2xl inline-flex items-center justify-center shrink-0',
                allOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              {allOk ? (
                <CheckCircle2 size={24} strokeWidth={2} />
              ) : (
                <ShieldAlert size={24} strokeWidth={2} />
              )}
            </span>
            <div>
              <h2 className="text-display text-2xl text-ink-900 leading-none">
                {allOk ? 'Alla system online' : `${downCount} tjänst${downCount === 1 ? '' : 'er'} svarar inte`}
              </h2>
              <p className="text-[12.5px] font-semibold text-ink-500 mt-1.5">
                {allOk
                  ? 'ELvis, Elvira och kunskapsbasen fungerar som de ska.'
                  : 'Vissa funktioner kan vara påverkade — se detaljer nedan.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Services */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((s) => (
            <Card key={s.key} variant="glass" className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <IconTile size="sm" tone={s.ok ? 'success' : 'danger'} icon={SERVICE_ICONS[s.key] ?? <ServerCog size={15} />} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold text-ink-900 leading-tight truncate">{s.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                    s.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                  )}
                >
                  {s.ok ? <CheckCircle2 size={11} strokeWidth={2.5} /> : <XCircle size={11} strokeWidth={2.5} />}
                  {s.ok ? 'Online' : 'Nere'}
                </span>
                {s.latency_ms != null && (
                  <span className="text-[10px] font-bold text-ink-400 tabular-nums">{s.latency_ms} ms</span>
                )}
              </div>
              <p className="text-[11.5px] text-ink-500 leading-snug">{s.detail}</p>
            </Card>
          ))}
        </div>

        {/* Last updated facts */}
        <div className="grid grid-cols-12 gap-5">
          {/* Knowledge base */}
          <div className="col-span-12 lg:col-span-6">
            <Card variant="glass" className="p-6 h-full">
              <FactHeader icon={<Library size={14} strokeWidth={1.75} />} tone="brand" title="Kunskapsbas" />
              <FactRow label="Källor" value={`${facts?.kb.source_count ?? 0}`} />
              <FactRow label="Indexerade chunks" value={(facts?.kb.chunk_count ?? 0).toLocaleString('sv-SE')} />
              <FactRow
                label="Senast uppdaterad"
                value={relativeTime(facts?.kb.last_kb_update ?? null)}
                sub={fullDate(facts?.kb.last_kb_update ?? null)}
              />
            </Card>
          </div>

          {/* Crawl */}
          <div className="col-span-12 lg:col-span-6">
            <Card variant="glass" className="p-6 h-full">
              <FactHeader icon={<Globe size={14} strokeWidth={1.75} />} tone="success" title="Webb-crawl (el-kretsen.se)" />
              <FactRow
                label="Senast crawlad"
                value={relativeTime(crawlLastCompleted)}
                sub={fullDate(crawlLastCompleted)}
              />
              {crawl?.last_completed && (
                <FactRow
                  label="Senaste resultat"
                  value={`${crawl.last_completed.ok} sidor`}
                  sub={`${crawl.last_completed.chunks} chunks · ${crawl.last_completed.failed} fel · ${crawl.last_completed.skipped} skippade`}
                />
              )}
              {!crawl?.last_completed && (
                <p className="text-[11.5px] text-ink-400 leading-snug mt-2">
                  Ingen schemalagd crawl har slutförts än — visar senaste kända indexering av en
                  webbsida.
                </p>
              )}

              {crawl?.in_progress && (
                <div className="mt-3 p-3 rounded-xl bg-brand-50 border border-brand-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-brand-800 mb-1.5">
                    <span>Crawl pågår…</span>
                    <span className="tabular-nums">
                      {crawl.in_progress.done} / {crawl.in_progress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden border border-brand-100">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all"
                      style={{
                        width: `${crawl.in_progress.total > 0 ? Math.round((crawl.in_progress.done / crawl.in_progress.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

            </Card>
          </div>

          {/* Audit */}
          <div className="col-span-12 lg:col-span-6">
            <Card variant="glass" className="p-6 h-full">
              <FactHeader icon={<ShieldAlert size={14} strokeWidth={1.75} />} tone="warning" title="Nattlig granskning (audit)" />
              <FactRow
                label="Senast körd"
                value={relativeTime(facts?.audit.last_run ?? null)}
                sub={fullDate(facts?.audit.last_run ?? null)}
              />
              <FactRow label="Ärenden att granska" value={`${facts?.audit.review_pending ?? 0}`} />
              {!facts?.audit.last_run && (
                <p className="text-[11.5px] text-amber-700 leading-snug mt-2">
                  Det schemalagda audit-jobbet är inte aktiverat än (aktiveras via pg_cron).
                </p>
              )}
            </Card>
          </div>

          {/* Drift */}
          <div className="col-span-12 lg:col-span-6">
            <Card variant="glass" className="p-6 h-full">
              <FactHeader icon={<ScanSearch size={14} strokeWidth={1.75} />} tone="neutral" title="Drift-koll (källor vs webb)" />
              <FactRow
                label="Senast kontrollerad"
                value={relativeTime(facts?.drift.last_check ?? null)}
                sub={fullDate(facts?.drift.last_check ?? null)}
              />
              {!facts?.drift.last_check && (
                <p className="text-[11.5px] text-ink-400 leading-snug mt-2">
                  Ingen drift-koll har körts än.
                </p>
              )}
            </Card>
          </div>
        </div>

        {isAdmin && <MaintenanceCard onChanged={load} />}
      </div>
    </div>
  );
}

function MaintenanceCard({ onChanged }: { onChanged: () => void }) {
  return (
    <Card variant="glass" className="p-6">
      <FactHeader icon={<ServerCog size={14} strokeWidth={1.75} />} tone="brand" title="Manuella körningar (admin)" />
      <p className="text-[12px] font-semibold text-ink-400 leading-relaxed mb-4 -mt-1">
        Kör underhållsjobben direkt istället för att vänta på schemat. Jobben kör batchvis tills de
        är klara — håll fliken öppen. Avbryts de fortsätter de där de var nästa gång eller via schemat.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <JobButton
          label="Crawla om sajten"
          icon={<Globe size={14} strokeWidth={1.75} />}
          onDone={onChanged}
          makeStep={() => {
            let started = false;
            return async () => {
              const r = started ? await triggerCrawl('advance') : await triggerCrawl('start');
              started = true;
              if (r.idle) return { done: true, summary: 'inget att crawla' };
              const total = r.total ?? 0;
              const off = r.completed ? total : Math.min(r.offset ?? 0, total);
              return { done: !!r.completed, summary: total ? `${off}/${total} sidor` : 'startar…' };
            };
          }}
        />
        <JobButton
          label="Kör nattaudit"
          icon={<ShieldAlert size={14} strokeWidth={1.75} />}
          onDone={onChanged}
          makeStep={() => async () => {
            const r = await runAuditBatch();
            const off = r.completed ? r.chunks_total : Math.min(r.batch_offset_next, r.chunks_total);
            return { done: r.completed, summary: `${off}/${r.chunks_total} stycken granskade` };
          }}
        />
        <JobButton
          label="Kör drift-koll"
          icon={<ScanSearch size={14} strokeWidth={1.75} />}
          onDone={onChanged}
          makeStep={() => {
            let checked = 0;
            let drift = 0;
            return async () => {
              const r = await runDriftBatch();
              checked += r.sources_checked;
              drift += r.drift_found;
              return { done: r.completed, summary: `${checked} källor · ${drift} avvikelser` };
            };
          }}
        />
      </div>
    </Card>
  );
}

function JobButton({
  label,
  icon,
  makeStep,
  onDone,
}: {
  label: string;
  icon: ReactNode;
  makeStep: () => () => Promise<{ done: boolean; summary: string }>;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    setDone(false);
    setProgress('startar…');
    const step = makeStep();
    try {
      let finished = false;
      for (let i = 0; i < 60; i++) {
        const r = await step();
        setProgress(r.summary);
        if (r.done) {
          finished = true;
          break;
        }
      }
      setDone(finished);
      if (!finished) setProgress((p) => `${p ?? ''} · pausad, kör igen för att fortsätta`);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3.5">
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<span className={cn(running && 'animate-spin')}>{icon}</span>}
        onClick={run}
        disabled={running}
        className="w-full"
      >
        {running ? 'Kör…' : label}
      </Button>
      {(progress || error) && (
        <p
          className={cn(
            'text-[11px] mt-2 leading-snug',
            error ? 'text-red-600' : done ? 'text-emerald-600' : 'text-ink-500',
          )}
        >
          {error ? error : done ? `Klart · ${progress ?? ''}` : progress}
        </p>
      )}
    </div>
  );
}

function FactHeader({ icon, tone, title }: { icon: ReactNode; tone: 'brand' | 'success' | 'warning' | 'neutral'; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <IconTile size="sm" tone={tone} icon={icon} />
      <h3 className="font-bold text-ink-900 text-[15px] leading-none">{title}</h3>
    </div>
  );
}

function FactRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-ink-100 last:border-0">
      <span className="text-[12.5px] font-semibold text-ink-500 inline-flex items-center gap-1.5">
        <Clock size={12} strokeWidth={2} className="text-ink-300" />
        {label}
      </span>
      <span className="text-right">
        <span className="block text-[13px] font-bold text-ink-900">{value}</span>
        {sub && <span className="block text-[10.5px] font-semibold text-ink-400 tabular-nums mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}
