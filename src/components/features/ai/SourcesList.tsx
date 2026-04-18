import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Library,
  Link2,
  Plus,
  Scale,
  Search,
  X,
} from 'lucide-react';
import { Button, Card, IconTile, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface SourceRow {
  filename: string;
  chunk_count: number;
}

interface SourcesListProps {
  refreshKey: number;
  onAdd: () => void;
  embedded?: boolean;
}

type GroupId = 'laws' | 'elkretsen' | 'internal';

interface Group {
  id: GroupId;
  label: string;
  icon: typeof Scale;
  items: SourceRow[];
}

function classifySource(filename: string): GroupId {
  if (!filename.includes('/') && !filename.includes('.com') && !filename.includes('.eu') && !filename.includes('.se'))
    return 'internal';
  if (filename.startsWith('www.el-kretsen.se') || filename.startsWith('el-kretsen.se')) return 'elkretsen';
  // riksdagen, eur-lex, environment.ec.europa.eu, etc.
  return 'laws';
}

function isUrlSource(filename: string): boolean {
  return classifySource(filename) !== 'internal';
}

function sourceDisplay(src: SourceRow): { name: string; href: string | null } {
  const group = classifySource(src.filename);
  if (group === 'internal') {
    return { name: src.filename.replace(/\.[^/.]+$/, ''), href: null };
  }
  // URL-based: collapse www.el-kretsen.se/path-segment to a short readable name
  const first = src.filename.split('/')[0];
  const rest = src.filename.slice(first.length);
  const niceRest = rest.replace(/^\//, '').replace(/[-_]/g, ' ').trim();
  return {
    name: niceRest || first,
    href: `https://${src.filename}`,
  };
}

export function SourcesList({ refreshKey, onAdd, embedded }: SourcesListProps) {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
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

  const groups = useMemo<Group[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sources.filter((s) => s.filename.toLowerCase().includes(q))
      : sources;
    return [
      {
        id: 'laws',
        label: 'Lagtexter & förordningar',
        icon: Scale,
        items: filtered.filter((s) => classifySource(s.filename) === 'laws'),
      },
      {
        id: 'elkretsen',
        label: 'el-kretsen.se',
        icon: Globe,
        items: filtered.filter((s) => classifySource(s.filename) === 'elkretsen'),
      },
      {
        id: 'internal',
        label: 'Interna dokument',
        icon: FileText,
        items: filtered.filter((s) => classifySource(s.filename) === 'internal'),
      },
    ];
  }, [sources, query]);

  const totalCount = sources.length;
  const filteredCount = groups.reduce((n, g) => n + g.items.length, 0);

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <IconTile size="sm" tone="neutral" icon={<Library size={14} strokeWidth={2.25} />} />
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-ink-900 text-sm leading-none">Kunskapsbas</h3>
        <p className="text-[11px] font-semibold text-ink-400 mt-0.5">
          {loading ? 'Laddar…' : `${totalCount} källor · ${filteredCount !== totalCount ? `${filteredCount} träffar` : 'alla'}`}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onAdd} leftIcon={<Plus size={14} strokeWidth={2.25} />}>
        URL
      </Button>
    </div>
  );

  const content = loading ? (
    <div className="flex justify-center py-6">
      <Spinner size={18} className="text-brand-500" />
    </div>
  ) : totalCount === 0 ? (
    <p className="text-xs text-ink-400 text-center py-4 font-medium">Inga källor ännu.</p>
  ) : (
    <>
      <div className="relative mb-3">
        <Search
          size={14}
          strokeWidth={2.25}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök bland källor…"
          className="w-full h-9 pl-9 pr-8 rounded-xl bg-white border border-ink-200 text-[13px] font-medium text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5"
            aria-label="Rensa sökning"
          >
            <X size={14} strokeWidth={2.25} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {groups.every((g) => g.items.length === 0) ? (
          <p className="text-xs text-ink-400 text-center py-6 font-medium">Inga källor matchar "{query}".</p>
        ) : (
          <div className="space-y-2.5">
            {groups.map((g) =>
              g.items.length === 0 ? null : (
                <GroupBlock
                  key={g.id}
                  group={g}
                  open={!!query || openGroups[g.id]}
                  onToggle={() =>
                    setOpenGroups((curr) => ({ ...curr, [g.id]: !curr[g.id] }))
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {header}
        {content}
      </div>
    );
  }

  return (
    <Card variant="glass" className="p-5 flex flex-col">
      {header}
      {content}
    </Card>
  );
}

function GroupBlock({
  group,
  open,
  onToggle,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = group.icon;
  return (
    <div className="rounded-xl border border-ink-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink-50 transition-colors"
      >
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          className={cn('text-ink-400 transition-transform duration-200', open && 'rotate-90')}
        />
        <Icon size={13} strokeWidth={2.25} className="text-brand-500" />
        <span className="flex-1 text-left text-[12px] font-bold text-ink-800">{group.label}</span>
        <span className="text-[10px] font-bold text-ink-400 tabular-nums">{group.items.length}</span>
      </button>

      {open && (
        <ul className="border-t border-ink-100 divide-y divide-ink-100 animate-fade-in">
          {group.items.map((src) => {
            const { name, href } = sourceDisplay(src);
            const IconCmp = isUrlSource(src.filename) ? Link2 : FileText;
            return (
              <li key={src.filename}>
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-ink-50 transition-colors">
                  <IconCmp
                    size={11}
                    strokeWidth={2.25}
                    className={cn(isUrlSource(src.filename) ? 'text-brand-500' : 'text-ink-400', 'shrink-0')}
                  />
                  <span
                    className="flex-1 min-w-0 text-[11.5px] font-semibold text-ink-700 truncate"
                    title={src.filename}
                  >
                    {name}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-ink-400 tabular-nums">
                    {src.chunk_count}
                  </span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-300 hover:text-brand-500 transition-colors shrink-0"
                      aria-label="Öppna källan"
                    >
                      <ExternalLink size={11} strokeWidth={2.25} />
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
