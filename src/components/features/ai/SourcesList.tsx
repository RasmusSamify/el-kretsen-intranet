import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
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
import {
  displayName,
  groupByDepartment,
  groupSources,
  isInternalSource,
  isLawDomain,
  type SourceRow,
} from '@/lib/kbSources';

interface SourcesListProps {
  refreshKey: number;
  onAdd: () => void;
  embedded?: boolean;
}

export function SourcesList({ refreshKey, onAdd, embedded }: SourcesListProps) {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
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
    return groupSources(filtered);
  }, [sources, query]);

  const totalCount = sources.length;
  const filteredCount =
    grouped.internal.length + grouped.domains.reduce((n, d) => n + d.items.length, 0);

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
        {filteredCount === 0 ? (
          <p className="text-xs text-ink-400 text-center py-6 font-medium">Inga källor matchar "{query}".</p>
        ) : (
          <div className="space-y-2.5">
            {grouped.domains.map((d) => (
              <DomainBlock
                key={d.host}
                label={d.label}
                icon={isLawDomain(d.host) ? Scale : Globe}
                items={d.items}
                open={!!query || openGroups.has(d.host)}
                onToggle={() => toggleGroup(d.host)}
              />
            ))}
            <InternalBlock
              items={grouped.internal}
              open={!!query || openGroups.has('internal')}
              onToggle={() => toggleGroup('internal')}
            />
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

function SourceRowItem({ src }: { src: SourceRow }) {
  const isUrl = !isInternalSource(src.filename);
  const href = isUrl ? `https://${src.filename}` : null;
  const IconCmp = isUrl ? Link2 : FileText;
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-ink-50 transition-colors">
      <IconCmp
        size={11}
        strokeWidth={2.25}
        className={cn(isUrl ? 'text-brand-500' : 'text-ink-400', 'shrink-0')}
      />
      <span
        className="flex-1 min-w-0 text-[11.5px] font-semibold text-ink-700 truncate"
        title={src.filename}
      >
        {displayName(src)}
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
  );
}

function DomainBlock({
  label,
  icon: Icon,
  items,
  open,
  onToggle,
}: {
  label: string;
  icon: typeof Globe;
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
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink-50 transition-colors"
      >
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          className={cn('text-ink-400 transition-transform duration-200', open && 'rotate-90')}
        />
        <Icon size={13} strokeWidth={2.25} className="text-brand-500" />
        <span className="flex-1 text-left text-[12px] font-bold text-ink-800 truncate">{label}</span>
        <span className="text-[10px] font-bold text-ink-400 tabular-nums">{items.length}</span>
      </button>

      {open && (
        <ul className="border-t border-ink-100 divide-y divide-ink-100 animate-fade-in">
          {items.map((src) => (
            <li key={src.filename}>
              <SourceRowItem src={src} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InternalBlock({
  items,
  open,
  onToggle,
}: {
  items: SourceRow[];
  open: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;
  const sections = groupByDepartment(items);
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
        <FileText size={13} strokeWidth={2.25} className="text-brand-500" />
        <span className="flex-1 text-left text-[12px] font-bold text-ink-800">Interna dokument</span>
        <span className="text-[10px] font-bold text-ink-400 tabular-nums">{items.length}</span>
      </button>

      {open && (
        <div className="border-t border-ink-100 animate-fade-in">
          {sections.map((section) => (
            <div key={section.key}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-50/60 border-b border-ink-100">
                <Building2 size={10} strokeWidth={2.25} className="text-ink-400" />
                <span className="flex-1 text-[9.5px] font-bold uppercase tracking-wider text-ink-500">
                  {section.dept}
                </span>
                <span className="text-[9.5px] font-bold text-ink-400 tabular-nums">{section.items.length}</span>
              </div>
              <ul className="divide-y divide-ink-100">
                {section.items.map((src) => (
                  <li key={src.filename}>
                    <SourceRowItem src={src} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
