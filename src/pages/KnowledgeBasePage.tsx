import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  FileType2,
  FileUp,
  Globe,
  HelpCircle,
  Library,
  Link2,
  Scale,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { AddSourceModal } from '@/components/features/ai/AddSourceModal';
import { AddFileModal } from '@/components/features/kb/AddFileModal';

interface SourceRow {
  filename: string;
  chunk_count: number;
}

type GroupId = 'laws' | 'elkretsen' | 'internal';

function classify(filename: string): GroupId {
  if (!filename.includes('/') && !filename.includes('.com') && !filename.includes('.eu') && !filename.includes('.se'))
    return 'internal';
  if (filename.startsWith('www.el-kretsen.se') || filename.startsWith('el-kretsen.se')) return 'elkretsen';
  return 'laws';
}

function displayName(src: SourceRow) {
  const g = classify(src.filename);
  if (g === 'internal') return src.filename.replace(/\.[^/.]+$/, '');
  return src.filename.split('/').slice(1).join('/').replace(/[-_]/g, ' ').trim() || src.filename;
}

export function KnowledgeBasePage() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addUrlOpen, setAddUrlOpen] = useState(false);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<GroupId, boolean>>({
    laws: false,
    elkretsen: false,
    internal: false,
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase.rpc('list_kb_sources').then(({ data, error }) => {
      if (!mounted) return;
      if (!error && data) setSources(data as SourceRow[]);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? sources.filter((s) => s.filename.toLowerCase().includes(q)) : sources;
    return {
      laws: filtered.filter((s) => classify(s.filename) === 'laws'),
      elkretsen: filtered.filter((s) => classify(s.filename) === 'elkretsen'),
      internal: filtered.filter((s) => classify(s.filename) === 'internal'),
    };
  }, [sources, query]);

  const totalChunks = sources.reduce((n, s) => n + s.chunk_count, 0);
  const filteredCount = grouped.laws.length + grouped.elkretsen.length + grouped.internal.length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Library size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Kunskapsbas</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Alla källor ELvis söker i · lägg till nya URL:er eller textfiler direkt här
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} strokeWidth={1.75} />
            <span>Semantisk indexering</span>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatPill label="Totalt källor" value={sources.length} />
          <StatPill label="Chunks indexerade" value={totalChunks} />
          <StatPill label="Lagtexter & förordningar" value={sources.filter((s) => classify(s.filename) === 'laws').length} />
          <StatPill label="Interna dokument" value={sources.filter((s) => classify(s.filename) === 'internal').length} />
        </div>

        {/* Two-column: sources list + instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
          {/* Sources list */}
          <Card variant="glass" className="p-6 flex flex-col min-h-[520px]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex-1">
                <h2 className="font-bold text-ink-900 text-[15px] leading-none">Alla källor</h2>
                <p className="text-[11px] font-semibold text-ink-400 mt-1">
                  {loading
                    ? 'Laddar…'
                    : query
                      ? `${filteredCount} träffar för "${query}"`
                      : `${sources.length} källor · grupperade efter typ`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Link2 size={14} strokeWidth={1.75} />}
                  onClick={() => setAddUrlOpen(true)}
                >
                  Lägg till URL
                </Button>
                <Button
                  size="sm"
                  leftIcon={<FileUp size={14} strokeWidth={1.75} />}
                  onClick={() => setAddFileOpen(true)}
                >
                  Ladda upp fil
                </Button>
              </div>
            </div>

            <div className="relative mb-4">
              <Search
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök bland alla källor…"
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-white border border-ink-200 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5"
                  aria-label="Rensa sökning"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner size={22} className="text-brand-500" />
              </div>
            ) : sources.length === 0 ? (
              <EmptySources onAddUrl={() => setAddUrlOpen(true)} onAddFile={() => setAddFileOpen(true)} />
            ) : filteredCount === 0 ? (
              <p className="text-[13px] text-ink-400 text-center py-10 font-medium">
                Inga källor matchar "{query}"
              </p>
            ) : (
              <div className="flex-1 space-y-2.5 -mx-1 px-1 overflow-y-auto">
                <Group
                  label="Lagtexter & förordningar"
                  icon={<Scale size={13} strokeWidth={1.75} />}
                  items={grouped.laws}
                  open={!!query || openGroups.laws}
                  onToggle={() => setOpenGroups((g) => ({ ...g, laws: !g.laws }))}
                />
                <Group
                  label="el-kretsen.se"
                  icon={<Globe size={13} strokeWidth={1.75} />}
                  items={grouped.elkretsen}
                  open={!!query || openGroups.elkretsen}
                  onToggle={() => setOpenGroups((g) => ({ ...g, elkretsen: !g.elkretsen }))}
                />
                <Group
                  label="Interna dokument"
                  icon={<FileText size={13} strokeWidth={1.75} />}
                  items={grouped.internal}
                  open={!!query || openGroups.internal}
                  onToggle={() => setOpenGroups((g) => ({ ...g, internal: !g.internal }))}
                />
              </div>
            )}
          </Card>

          {/* Instructions */}
          <InstructionsPanel />
        </div>

        <AddSourceModal
          open={addUrlOpen}
          onClose={() => setAddUrlOpen(false)}
          onAdded={() => setRefreshKey((k) => k + 1)}
        />
        <AddFileModal
          open={addFileOpen}
          onClose={() => setAddFileOpen(false)}
          onAdded={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="glass" className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="text-display text-3xl text-ink-900 tabular-nums leading-none mt-2">
        {value.toLocaleString('sv-SE')}
      </p>
    </Card>
  );
}

function Group({
  label,
  icon,
  items,
  open,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  items: SourceRow[];
  open: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-ink-50 transition-colors"
      >
        <ChevronRight
          size={14}
          strokeWidth={2}
          className={cn('text-ink-400 transition-transform duration-200', open && 'rotate-90')}
        />
        <span className="text-ink-500">{icon}</span>
        <span className="flex-1 text-left text-[13px] font-bold text-ink-800">{label}</span>
        <span className="text-[11px] font-bold text-ink-400 tabular-nums">{items.length}</span>
      </button>
      {open && (
        <ul className="border-t border-ink-100 divide-y divide-ink-100">
          {items.map((src) => {
            const isUrl = classify(src.filename) !== 'internal';
            const href = isUrl ? `https://${src.filename}` : null;
            return (
              <li key={src.filename}>
                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50 transition-colors">
                  {isUrl ? (
                    <Link2 size={12} strokeWidth={1.75} className="text-ink-500 shrink-0" />
                  ) : (
                    <FileText size={12} strokeWidth={1.75} className="text-ink-500 shrink-0" />
                  )}
                  <span
                    className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink-700 truncate"
                    title={src.filename}
                  >
                    {displayName(src)}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-ink-400 tabular-nums">
                    {src.chunk_count} chunks
                  </span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-300 hover:text-ink-900 transition-colors shrink-0"
                      aria-label="Öppna källan"
                    >
                      <ExternalLink size={11} strokeWidth={1.75} />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptySources({ onAddUrl, onAddFile }: { onAddUrl: () => void; onAddFile: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <Library size={36} strokeWidth={1.25} className="text-ink-400 mb-4" />
      <h3 className="text-display text-xl text-ink-900">Kunskapsbasen är tom</h3>
      <p className="text-[13px] text-ink-500 max-w-sm leading-relaxed mt-2">
        Lägg till en URL eller ladda upp en TXT-fil så börjar ELvis indexera den automatiskt.
      </p>
      <div className="flex gap-2 mt-6">
        <Button variant="secondary" size="sm" leftIcon={<Link2 size={14} strokeWidth={1.75} />} onClick={onAddUrl}>
          Lägg till URL
        </Button>
        <Button size="sm" leftIcon={<FileUp size={14} strokeWidth={1.75} />} onClick={onAddFile}>
          Ladda upp fil
        </Button>
      </div>
    </div>
  );
}

function InstructionsPanel() {
  return (
    <div className="space-y-5">
      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <HelpCircle size={16} strokeWidth={1.75} className="text-ink-500" />
          <div>
            <h3 className="font-bold text-ink-900 text-[14px] leading-none">Så lägger du till innehåll</h3>
            <p className="text-[11px] font-semibold text-ink-400 mt-1">Två vägar — båda tar några sekunder</p>
          </div>
        </div>

        <div className="space-y-4">
          <StepBlock
            number="1"
            icon={<Link2 size={14} strokeWidth={1.75} />}
            title="URL från webben"
            body="Klistra in adressen till en lagtext, riktlinje eller informationssida. Systemet hämtar sidan, strippar menyer/fotnoter och indexerar innehållet."
            tip="Funkar inte på JavaScript-tunga sidor (t.ex. gamla intranät där text laddas dynamiskt)."
          />
          <StepBlock
            number="2"
            icon={<FileUp size={14} strokeWidth={1.75} />}
            title="Ladda upp textfil"
            body="Dra och släpp en .txt-fil (max 1,5 MB) i uppladdningsrutan. Filen chunkas automatiskt och embedded semantiskt."
            tip="Har du PDF eller Word? Konvertera till text först — se nedan."
          />
        </div>
      </Card>

      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileType2 size={16} strokeWidth={1.75} className="text-ink-500" />
          <div>
            <h3 className="font-bold text-ink-900 text-[14px] leading-none">Konvertera till TXT</h3>
            <p className="text-[11px] font-semibold text-ink-400 mt-1">
              ELvis behöver ren text — här är enklaste vägen från vanliga format
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <ConvertRow
            format="PDF"
            steps="Öppna PDF:en → Markera all text (Ctrl+A) → Kopiera (Ctrl+C) → Klistra in i Anteckningar/Notepad → Spara som .txt"
          />
          <ConvertRow
            format="Word (.docx)"
            steps='I Word: Arkiv → Spara som → välj format "Oformaterad text (*.txt)" → Spara'
          />
          <ConvertRow
            format="Excel (.xlsx)"
            steps='Spara arket som "CSV UTF-8" eller "Text (tabavgränsad)" och döp om filändelsen till .txt'
          />
          <ConvertRow
            format="Webbsida"
            steps="Hoppa över — använd URL-importen ovan istället, den hämtar sidan åt dig"
          />
        </div>

        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertCircle size={14} strokeWidth={2} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-amber-900 leading-relaxed">
            Har ni PDF med tabeller eller bilder där texten inte går att markera? Skicka filen till oss
            (<a href="mailto:info@samify.se" className="font-bold underline">info@samify.se</a>) så
            extraherar vi texten åt er.
          </p>
        </div>
      </Card>

      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={16} strokeWidth={1.75} className="text-ink-500" />
          <div>
            <h3 className="font-bold text-ink-900 text-[14px] leading-none">Bra att veta</h3>
            <p className="text-[11px] font-semibold text-ink-400 mt-1">Tips för en välmående kunskapsbas</p>
          </div>
        </div>

        <ul className="space-y-2 text-[12.5px] text-ink-700 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-400 mt-[7px] shrink-0" />
            <span>
              <strong className="text-ink-900">Uppdaterade dokument ersätter gamla.</strong> Ladda upp
              samma filnamn igen så byts innehållet ut automatiskt — inga dubbletter.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-400 mt-[7px] shrink-0" />
            <span>
              <strong className="text-ink-900">Mer ≠ alltid bättre.</strong> ELvis presterar bäst på
              fokuserade dokument. Dela upp långa PDF:er i logiska delar om möjligt.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-400 mt-[7px] shrink-0" />
            <span>
              <strong className="text-ink-900">Obesvarade frågor visar luckor.</strong> Gå till{' '}
              <em>Insikter</em> för att se vilka frågor ELvis missar — perfekt guide för vad som ska
              läggas till härnäst.
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function StepBlock({
  number,
  icon,
  title,
  body,
  tip,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tip?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-ink-900 text-white inline-flex items-center justify-center font-display text-sm">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 text-ink-700">
          {icon}
          <p className="text-[13px] font-bold text-ink-900">{title}</p>
        </div>
        <p className="text-[12.5px] text-ink-600 leading-relaxed">{body}</p>
        {tip && <p className="text-[11.5px] text-ink-400 mt-1 italic">Obs: {tip}</p>}
      </div>
    </div>
  );
}

function ConvertRow({ format, steps }: { format: string; steps: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-white border border-ink-100">
      <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-ink-100 text-ink-700 text-[10px] font-black uppercase tracking-wider h-fit">
        {format}
      </span>
      <p className="text-[12px] text-ink-700 leading-relaxed">{steps}</p>
    </div>
  );
}
