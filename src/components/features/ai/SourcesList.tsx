import { useEffect, useState } from 'react';
import { Library, FileText, Link2, Plus, ExternalLink } from 'lucide-react';
import { Card, IconTile, Spinner, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';

interface SourceRow {
  filename: string;
  chunk_count: number;
}

interface SourcesListProps {
  refreshKey: number;
  onAdd: () => void;
  embedded?: boolean;
}

export function SourcesList({ refreshKey, onAdd, embedded }: SourcesListProps) {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .rpc('list_kb_sources')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data) setSources(data as SourceRow[]);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <IconTile size="sm" tone="neutral" icon={<Library size={14} strokeWidth={2.25} />} />
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-ink-900 text-sm leading-none">Kunskapsbas</h3>
        <p className="text-[11px] font-semibold text-ink-400 mt-0.5">
          {loading ? 'Laddar…' : `${sources.length} källor indexerade`}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onAdd} leftIcon={<Plus size={14} strokeWidth={2.25} />}>
        URL
      </Button>
    </div>
  );

  const list = loading ? (
    <div className="flex justify-center py-6">
      <Spinner size={18} className="text-brand-500" />
    </div>
  ) : sources.length === 0 ? (
    <p className="text-xs text-ink-400 text-center py-4 font-medium">Inga källor ännu.</p>
  ) : (
    <ul className="space-y-1.5">
      {sources.map((src) => {
        const isUrl = src.filename.includes('/') || src.filename.includes('.com') || src.filename.includes('.se');
        const displayName = isUrl ? src.filename : src.filename.replace(/\.[^/.]+$/, '');
        return (
          <li key={src.filename}>
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-ink-100 hover:border-ink-200 transition-colors">
              {isUrl ? (
                <Link2 size={12} className="text-brand-500 shrink-0" strokeWidth={2.25} />
              ) : (
                <FileText size={12} className="text-ink-400 shrink-0" strokeWidth={2.25} />
              )}
              <span className="flex-1 min-w-0 text-[11.5px] font-semibold text-ink-700 truncate" title={src.filename}>
                {displayName}
              </span>
              <span className="shrink-0 text-[10px] font-bold text-ink-400 tabular-nums">
                {src.chunk_count}
              </span>
              {isUrl && (
                <a
                  href={`https://${src.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-300 hover:text-brand-500 transition-colors"
                  aria-label="Öppna källan i ny flik"
                >
                  <ExternalLink size={11} strokeWidth={2.25} />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (embedded) {
    return (
      <div>
        {header}
        {list}
      </div>
    );
  }

  return (
    <Card variant="glass" className="p-5">
      {header}
      {list}
    </Card>
  );
}
