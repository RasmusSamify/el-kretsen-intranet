import { useMemo, useState } from 'react';
import {
  Globe,
  ClipboardList,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  ListChecks,
  ArrowLeft,
  X,
} from 'lucide-react';
import { Button, Input, Modal, IconTile, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { crawlDiscover, ingestUrl, type DiscoveredUrl } from '@/lib/api';

interface CrawlSiteModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type Mode = 'domain' | 'paste';
type Phase = 'input' | 'review' | 'running' | 'done';
type UrlStatus = 'pending' | 'ok' | 'failed';

interface RunResult {
  url: string;
  status: UrlStatus;
  detail?: string;
}

const INGEST_CONCURRENCY = 4;

export function CrawlSiteModal({ open, onClose, onAdded }: CrawlSiteModalProps) {
  const [mode, setMode] = useState<Mode>('domain');
  const [phase, setPhase] = useState<Phase>('input');

  // Inputs
  const [domainUrl, setDomainUrl] = useState('');
  const [scope, setScope] = useState('');
  const [pasteText, setPasteText] = useState('');

  // Discovery
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredUrl[]>([]);
  const [origin, setOrigin] = useState('');
  const [fromSitemap, setFromSitemap] = useState(false);

  // Selection
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Run
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [doneCount, setDoneCount] = useState(0);

  const reset = () => {
    setMode('domain');
    setPhase('input');
    setDomainUrl('');
    setScope('');
    setPasteText('');
    setDiscovering(false);
    setError(null);
    setDiscovered([]);
    setOrigin('');
    setFromSitemap(false);
    setChecked(new Set());
    setSearch('');
    setResults(new Map());
    setDoneCount(0);
  };

  const close = () => {
    if (phase === 'running') return; // blockera stängning mitt i en körning
    reset();
    onClose();
  };

  // ── Steg 1: hitta sidor ──────────────────────────────────────────────
  const runDiscover = async () => {
    setError(null);
    setDiscovering(true);
    try {
      const res = await crawlDiscover(domainUrl.trim(), scope.trim() || null);
      if (res.urls.length === 0) {
        setError(
          'Hittade inga sidor. Sajten kanske saknar sitemap eller laddar innehåll med JavaScript. Prova "Klistra in lista" istället.',
        );
        return;
      }
      setDiscovered(res.urls);
      setOrigin(res.origin);
      setFromSitemap(res.fromSitemap);
      setChecked(new Set(res.urls.map((u) => u.url))); // allt förbockat (Linneas val)
      setPhase('review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDiscovering(false);
    }
  };

  const usePastedList = () => {
    setError(null);
    const urls = parsePastedUrls(pasteText);
    if (urls.length === 0) {
      setError('Inga giltiga URL:er hittades. Klistra in en länk per rad (måste börja med http:// eller https://).');
      return;
    }
    setDiscovered(urls);
    setOrigin('');
    setFromSitemap(false);
    setChecked(new Set(urls.map((u) => u.url)));
    setPhase('review');
  };

  // ── Steg 3: indexera de ikryssade ────────────────────────────────────
  const runIngest = async () => {
    const queue = discovered.filter((d) => checked.has(d.url));
    if (queue.length === 0) return;

    const init = new Map<string, RunResult>();
    queue.forEach((d) => init.set(d.url, { url: d.url, status: 'pending' }));
    setResults(init);
    setDoneCount(0);
    setPhase('running');

    let added = false;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        let result: RunResult;
        try {
          await ingestUrl(item.url);
          result = { url: item.url, status: 'ok' };
          added = true;
        } catch (e) {
          result = { url: item.url, status: 'failed', detail: (e as Error).message };
        }
        setResults((prev) => {
          const next = new Map(prev);
          next.set(item.url, result);
          return next;
        });
        setDoneCount((n) => n + 1);
      }
    };

    await Promise.all(Array.from({ length: Math.min(INGEST_CONCURRENCY, queue.length) }, worker));
    if (added) onAdded();
    setPhase('done');
  };

  // ── Härledd data för checklistan ─────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? discovered.filter((d) => d.url.toLowerCase().includes(q)) : discovered;
  }, [discovered, search]);

  const checkedCount = checked.size;

  const toggle = (url: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  const setAllFiltered = (on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      for (const d of filtered) {
        if (on) next.add(d.url);
        else next.delete(d.url);
      }
      return next;
    });

  const okCount = Array.from(results.values()).filter((r) => r.status === 'ok').length;
  const failCount = Array.from(results.values()).filter((r) => r.status === 'failed').length;
  const total = results.size;

  return (
    <Modal open={open} onClose={close} title="Crawla sajt till kunskapsbasen" size="2xl">
      {/* ── INPUT ── */}
      {phase === 'input' && (
        <div className="p-6 space-y-5">
          {/* Lägesväljare */}
          <div className="flex gap-2">
            <ModeTab
              active={mode === 'domain'}
              icon={<Globe size={15} strokeWidth={2} />}
              label="Crawla domän"
              onClick={() => {
                setMode('domain');
                setError(null);
              }}
            />
            <ModeTab
              active={mode === 'paste'}
              icon={<ClipboardList size={15} strokeWidth={2} />}
              label="Klistra in lista"
              onClick={() => {
                setMode('paste');
                setError(null);
              }}
            />
          </div>

          {mode === 'domain' ? (
            <div className="space-y-4">
              <div className="flex gap-3">
                <IconTile icon={<Globe size={16} strokeWidth={2.25} />} tone="brand" size="md" />
                <p className="flex-1 text-[13px] text-ink-700 leading-relaxed">
                  Ange en webbplats så hittar systemet alla undersidor via sajtens sitemap. Du får en
                  lista att bocka i och ur innan något indexeras — basen hålls kurerad, du bestämmer.
                </p>
              </div>
              <div>
                <label className="text-eyebrow block mb-2">Webbplats</label>
                <Input
                  type="url"
                  value={domainUrl}
                  onChange={(e) => setDomainUrl(e.target.value)}
                  placeholder="https://www.naturvardsverket.se"
                  disabled={discovering}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-eyebrow block mb-2">
                  Begränsa till sökväg <span className="text-ink-400 font-medium normal-case">(valfritt)</span>
                </label>
                <Input
                  type="text"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="/vagledning-och-stod/producentansvar"
                  disabled={discovering}
                />
                <p className="text-[11px] text-ink-400 mt-1.5">
                  Lämna tomt för hela sajten. Anger du en sökväg tas bara sidor under den med.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <IconTile icon={<ClipboardList size={16} strokeWidth={2.25} />} tone="brand" size="md" />
                <p className="flex-1 text-[13px] text-ink-700 leading-relaxed">
                  Klistra in en lista med länkar — en per rad. Perfekt när du redan har de exakta
                  sidorna (t.ex. specifika vägledningssidor eller EU-förordningar).
                </p>
              </div>
              <div>
                <label className="text-eyebrow block mb-2">URL:er — en per rad</label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'https://www.naturvardsverket.se/...\nhttps://eur-lex.europa.eu/...'}
                  rows={7}
                  className="w-full rounded-xl bg-white border border-ink-200 px-3 py-2.5 text-[12.5px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all resize-y"
                  autoFocus
                />
              </div>
            </div>
          )}

          {error && <ErrorBox message={error} />}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={close}>
              Avbryt
            </Button>
            {mode === 'domain' ? (
              <Button onClick={runDiscover} loading={discovering} disabled={!domainUrl.trim()} leftIcon={<Search size={15} strokeWidth={2} />}>
                Hitta sidor
              </Button>
            ) : (
              <Button onClick={usePastedList} disabled={!pasteText.trim()} leftIcon={<ListChecks size={15} strokeWidth={2} />}>
                Granska lista
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── REVIEW (checklista) ── */}
      {phase === 'review' && (
        <div className="flex flex-col" style={{ maxHeight: '75vh' }}>
          <div className="px-6 pt-5 pb-3 border-b border-ink-100">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[13px] font-bold text-ink-900">
                  {discovered.length} sidor hittade{origin && <span className="text-ink-400 font-semibold"> · {origin.replace(/^https?:\/\//, '')}</span>}
                </p>
                <p className="text-[11.5px] text-ink-500 mt-0.5">
                  {fromSitemap ? 'Via sajtens sitemap. ' : 'Via länkar på sidan. '}
                  Bocka ur det som inte ska in — bara ikryssade indexeras.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-900 text-white text-[12px] font-bold tabular-nums">
                <ListChecks size={13} strokeWidth={2.25} />
                {checkedCount} valda
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1">
                <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrera sidor…"
                  className="w-full h-9 pl-9 pr-8 rounded-lg bg-white border border-ink-200 text-[12.5px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5" aria-label="Rensa">
                    <X size={13} strokeWidth={2} />
                  </button>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setAllFiltered(true)}>
                Markera {search ? 'träffar' : 'alla'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAllFiltered(false)}>
                Avmarkera {search ? 'träffar' : 'alla'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 min-h-[200px]">
            {filtered.length === 0 ? (
              <p className="text-[13px] text-ink-400 text-center py-10 font-medium">Inga sidor matchar "{search}"</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {filtered.map((d) => {
                  const on = checked.has(d.url);
                  return (
                    <li key={d.url}>
                      <button
                        type="button"
                        onClick={() => toggle(d.url)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors text-left"
                      >
                        <span
                          className={cn(
                            'shrink-0 w-[18px] h-[18px] rounded-[5px] border-2 inline-flex items-center justify-center transition-colors',
                            on ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-300',
                          )}
                        >
                          {on && <CheckCircle2 size={12} strokeWidth={3} className="text-white" />}
                        </span>
                        <Link2 size={12} strokeWidth={1.75} className="shrink-0 text-ink-400" />
                        <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-ink-700" title={d.url}>
                          {d.path || d.url}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-between gap-2">
            <Button variant="ghost" type="button" onClick={() => setPhase('input')} leftIcon={<ArrowLeft size={15} strokeWidth={2} />}>
              Tillbaka
            </Button>
            <Button onClick={runIngest} disabled={checkedCount === 0} leftIcon={<CheckCircle2 size={15} strokeWidth={2} />}>
              Indexera {checkedCount} {checkedCount === 1 ? 'sida' : 'sidor'}
            </Button>
          </div>
        </div>
      )}

      {/* ── RUNNING / DONE ── */}
      {(phase === 'running' || phase === 'done') && (
        <div className="flex flex-col" style={{ maxHeight: '75vh' }}>
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <IconTile
                icon={phase === 'done' ? <CheckCircle2 size={18} strokeWidth={2.25} /> : <Loader2 size={18} strokeWidth={2.25} className="animate-spin" />}
                tone={phase === 'done' ? 'success' : 'brand'}
                size="lg"
              />
              <div>
                <h3 className="text-display text-xl text-ink-900 leading-none">
                  {phase === 'done' ? 'Indexering klar' : 'Indexerar sidor…'}
                </h3>
                <p className="text-[12px] font-semibold text-ink-400 mt-1 tabular-nums">
                  {doneCount} av {total} klara · {okCount} lyckades · {failCount} misslyckades
                </p>
              </div>
            </div>

            <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-300', failCount > 0 && doneCount === total ? 'bg-amber-500' : 'bg-brand-600')}
                style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%` }}
              />
            </div>
            {phase === 'running' && (
              <p className="text-[11.5px] text-ink-400 mt-2">
                Stäng inte fönstret — sidorna hämtas, rensas och indexeras en i taget.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-[160px]">
            <ul className="divide-y divide-ink-50">
              {Array.from(results.values()).map((r) => (
                <li key={r.url} className="flex items-center gap-2.5 px-3 py-2">
                  <StatusDot status={r.status} />
                  <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-ink-600" title={r.url}>
                    {prettyPath(r.url)}
                  </span>
                  {r.status === 'failed' && r.detail && (
                    <span className="shrink-0 max-w-[45%] truncate text-[11px] font-medium text-red-600" title={r.detail}>
                      {r.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {phase === 'done' && (
            <div className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-2">
              {failCount > 0 && (
                <span className="mr-auto text-[12px] text-ink-500 font-medium">
                  {failCount} sidor gick inte att indexera (ofta JS-renderat innehåll).
                </span>
              )}
              <Button onClick={close}>Klar</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ModeTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-bold transition-colors border',
        active ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusDot({ status }: { status: UrlStatus }) {
  if (status === 'ok') return <CheckCircle2 size={14} strokeWidth={2.5} className="shrink-0 text-emerald-600" />;
  if (status === 'failed') return <AlertCircle size={14} strokeWidth={2.5} className="shrink-0 text-red-600" />;
  return <Spinner size={13} className="shrink-0 text-ink-300" />;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
      <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2.25} />
      <p className="text-[13px] text-red-700 leading-snug">{message}</p>
    </div>
  );
}

function parsePastedUrls(text: string): DiscoveredUrl[] {
  const seen = new Set<string>();
  const out: DiscoveredUrl[] = [];
  for (const raw of text.split(/[\s]+/)) {
    const s = raw.trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url: key, path: `${u.host}${u.pathname}` });
    } catch {
      /* ej en URL, hoppa */
    }
  }
  return out;
}

function prettyPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
