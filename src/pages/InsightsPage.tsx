import { useEffect, useState } from 'react';
import {
  BarChart3,
  CircleHelp,
  Database,
  Flame,
  Library,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Trophy,
} from 'lucide-react';
import { Card, IconTile, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatDate, cn } from '@/lib/utils';

interface Stats {
  total_questions: number;
  unique_questions: number;
  questions_last_7d: number;
  unanswered_total: number;
  unanswered_last_7d: number;
  source_count: number;
  chunk_count: number;
  quiz_scores_total: number;
}

interface FaqRow {
  id: string;
  question_text: string;
  count: number;
  last_asked: string;
}

interface UnansweredRow {
  id: string;
  question_text: string;
  top_match_filename: string | null;
  top_match_similarity: number | null;
  created_at: string;
  notified: boolean;
}

interface SourceRow {
  filename: string;
  chunk_count: number;
}

export function InsightsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topFaqs, setTopFaqs] = useState<FaqRow[]>([]);
  const [unanswered, setUnanswered] = useState<UnansweredRow[]>([]);
  const [topSources, setTopSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [statsRes, faqRes, unansweredRes, sourcesRes] = await Promise.all([
        supabase.rpc('dashboard_stats'),
        supabase
          .from('ai_questions')
          .select('id, question_text, count, last_asked')
          .order('count', { ascending: false })
          .limit(8),
        supabase
          .from('ai_unanswered')
          .select('id, question_text, top_match_filename, top_match_similarity, created_at, notified')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.rpc('list_kb_sources'),
      ]);

      if (statsRes.data) setStats(statsRes.data as Stats);
      if (faqRes.data) setTopFaqs(faqRes.data as FaqRow[]);
      if (unansweredRes.data) setUnanswered(unansweredRes.data as UnansweredRow[]);
      if (sourcesRes.data) {
        const sorted = (sourcesRes.data as SourceRow[])
          .slice()
          .sort((a, b) => b.chunk_count - a.chunk_count)
          .slice(0, 8);
        setTopSources(sorted);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={28} className="text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto pb-8 space-y-6">
        <header className="flex items-center gap-3">
          <IconTile icon={<BarChart3 size={18} strokeWidth={2.25} />} tone="brand" size="md" />
          <div>
            <h1 className="text-display text-3xl text-ink-900 leading-none">Insikter</h1>
            <p className="text-[12px] font-semibold text-ink-400 mt-1">
              Översikt över AI-användning, kunskapsbas och obesvarade frågor
            </p>
          </div>
        </header>

        {/* KPI-row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Frågor totalt"
            value={stats?.total_questions ?? 0}
            delta={stats?.questions_last_7d ?? 0}
            deltaLabel="senaste 7 dagar"
            icon={<MessageSquareText size={14} strokeWidth={2.25} />}
            tone="brand"
          />
          <KpiCard
            label="Obesvarade"
            value={stats?.unanswered_total ?? 0}
            delta={stats?.unanswered_last_7d ?? 0}
            deltaLabel="senaste 7 dagar"
            icon={<TriangleAlert size={14} strokeWidth={2.25} />}
            tone="warning"
            accent
          />
          <KpiCard
            label="Källor i kunskapsbas"
            value={stats?.source_count ?? 0}
            delta={stats?.chunk_count ?? 0}
            deltaLabel="chunks totalt"
            icon={<Library size={14} strokeWidth={2.25} />}
            tone="neutral"
          />
          <KpiCard
            label="Kretskampen-omgångar"
            value={stats?.quiz_scores_total ?? 0}
            delta={null}
            deltaLabel="alla tider"
            icon={<Trophy size={14} strokeWidth={2.25} />}
            tone="success"
          />
        </div>

        {/* Two-column: unanswered + top FAQ */}
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
          {/* Unanswered */}
          <Card variant="glass" className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <IconTile size="sm" tone="warning" icon={<CircleHelp size={14} strokeWidth={2.25} />} />
              <div className="flex-1">
                <h3 className="font-bold text-ink-900 text-[15px] leading-none">Senaste obesvarade</h3>
                <p className="text-[11px] font-semibold text-ink-400 mt-1">
                  Frågor som inte kunde besvaras från kunskapsbasen
                </p>
              </div>
            </div>

            {unanswered.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-6 font-medium">
                Inga obesvarade frågor än.
              </p>
            ) : (
              <ul className="space-y-2">
                {unanswered.map((row) => (
                  <li
                    key={row.id}
                    className="p-3 rounded-xl bg-white border border-ink-100"
                  >
                    <p className="text-[13px] font-semibold text-ink-800 leading-snug">
                      {row.question_text}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                      <span>{formatDate(row.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {row.top_match_similarity != null && (
                        <>
                          <span className="opacity-50">·</span>
                          <span>
                            närmast: {Math.round(row.top_match_similarity * 100)} %
                          </span>
                        </>
                      )}
                      {row.notified && (
                        <>
                          <span className="opacity-50">·</span>
                          <span className="text-emerald-600">mail skickat</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Top FAQ */}
          <Card variant="glass" className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <IconTile size="sm" tone="warning" icon={<Flame size={14} strokeWidth={2.25} />} />
              <div className="flex-1">
                <h3 className="font-bold text-ink-900 text-[15px] leading-none">Populärast</h3>
                <p className="text-[11px] font-semibold text-ink-400 mt-1">Mest ställda frågor</p>
              </div>
            </div>

            {topFaqs.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-6 font-medium">
                Inga frågor än — börja chatta!
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topFaqs.map((faq, i) => (
                  <li
                    key={faq.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-ink-100"
                  >
                    <span
                      className={cn(
                        'w-7 h-7 rounded-lg inline-flex items-center justify-center font-display text-sm shrink-0',
                        i === 0 ? 'bg-amber-50 text-amber-700' : 'bg-ink-50 text-ink-500',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink-700 truncate">
                      {faq.question_text}
                    </span>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                      {faq.count}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Top sources */}
        <Card variant="glass" className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <IconTile size="sm" tone="neutral" icon={<Database size={14} strokeWidth={2.25} />} />
            <div className="flex-1">
              <h3 className="font-bold text-ink-900 text-[15px] leading-none">Största källor</h3>
              <p className="text-[11px] font-semibold text-ink-400 mt-1">
                Källor med flest indexerade chunks
              </p>
            </div>
          </div>

          {topSources.length === 0 ? (
            <p className="text-xs text-ink-400 text-center py-6 font-medium">
              Inga källor än.
            </p>
          ) : (
            <div className="space-y-2">
              {topSources.map((src, i) => {
                const maxChunks = topSources[0]?.chunk_count || 1;
                const pct = (src.chunk_count / maxChunks) * 100;
                const isUrl = src.filename.includes('/') || src.filename.includes('.se') || src.filename.includes('.eu');
                const displayName = isUrl ? src.filename : src.filename.replace(/\.[^/.]+$/, '');
                return (
                  <div key={src.filename} className="group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-ink-400 tabular-nums w-6">
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink-700 truncate">
                        {displayName}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-ink-800 tabular-nums">
                        {src.chunk_count} chunks
                      </span>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Footer hint */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-ink-400 py-4">
          <Sparkles size={12} strokeWidth={2.25} />
          <span>Uppdateras i realtid · Data från Supabase</span>
          <TrendingUp size={12} strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
  tone,
  accent,
}: {
  label: string;
  value: number;
  delta: number | null;
  deltaLabel: string;
  icon: React.ReactNode;
  tone: 'brand' | 'warning' | 'neutral' | 'success';
  accent?: boolean;
}) {
  return (
    <Card
      variant="glass"
      className={cn(
        'p-4',
        accent && (value > 0 ? 'border-amber-200 bg-amber-50/40' : ''),
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <IconTile size="sm" tone={tone} icon={icon} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 truncate">
          {label}
        </span>
      </div>
      <p className="text-display text-4xl text-ink-900 leading-none tabular-nums">
        {value.toLocaleString('sv-SE')}
      </p>
      {delta != null && (
        <p className="text-[11px] font-semibold text-ink-400 mt-2">
          <span className="text-ink-700 tabular-nums">{delta.toLocaleString('sv-SE')}</span>{' '}
          {deltaLabel}
        </p>
      )}
    </Card>
  );
}
