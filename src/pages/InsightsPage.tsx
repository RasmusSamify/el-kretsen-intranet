import { useEffect, useState, type ReactNode } from 'react';
import {
  ChartLineUp as BarChart3,
  Question as CircleHelp,
  Database,
  FireSimple as Flame,
  Books as Library,
  ChatsCircle as MessageSquareText,
  Sparkle as Sparkles,
  TrendUp as TrendingUp,
  WarningCircle as TriangleAlert,
  Trophy,
} from '@phosphor-icons/react';
import { Card, FeatureIcon, IconTile, Spinner } from '@/components/ui';
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
          .limit(10),
        supabase
          .from('ai_unanswered')
          .select('id, question_text, top_match_filename, top_match_similarity, created_at, notified')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.rpc('list_kb_sources'),
      ]);

      if (statsRes.data) setStats(statsRes.data as Stats);
      if (faqRes.data) setTopFaqs(faqRes.data as FaqRow[]);
      if (unansweredRes.data) setUnanswered(unansweredRes.data as UnansweredRow[]);
      if (sourcesRes.data) {
        const sorted = (sourcesRes.data as SourceRow[])
          .slice()
          .sort((a, b) => b.chunk_count - a.chunk_count)
          .slice(0, 10);
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FeatureIcon icon={<BarChart3 weight="duotone" />} tone="brand" size="lg" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Insikter</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Översikt över AI-användning, kunskapsbas och obesvarade frågor
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} weight="bold" />
            <span>Realtid</span>
          </div>
        </header>

        {/* HERO row — two big asymmetric cards */}
        <div className="grid grid-cols-12 gap-5">
          {/* Biggest hero — total usage */}
          <div className="col-span-12 lg:col-span-7">
            <HeroCard
              label="Total användning"
              value={stats?.total_questions ?? 0}
              subValue={stats?.unique_questions ?? 0}
              subLabel="olika frågor (unika)"
              delta={stats?.questions_last_7d ?? 0}
              deltaLabel="aktiva senaste 7 dagarna"
              icon={<MessageSquareText weight="duotone" />}
              tone="brand"
            />
          </div>

          {/* Secondary hero — unanswered */}
          <div className="col-span-12 lg:col-span-5">
            <HeroCard
              label="Kunskapsluckor"
              value={stats?.unanswered_total ?? 0}
              subValue={null}
              subLabel={stats?.unanswered_total === 0 ? 'Alla frågor besvarade' : 'obesvarade totalt'}
              delta={stats?.unanswered_last_7d ?? 0}
              deltaLabel="senaste 7 dagar"
              icon={<TriangleAlert weight="duotone" />}
              tone={(stats?.unanswered_total ?? 0) > 0 ? 'warning' : 'success'}
              compact
            />
          </div>
        </div>

        {/* Secondary KPI row — 3 support cards */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-6 lg:col-span-4">
            <StatCard
              label="Källor i kunskapsbas"
              value={stats?.source_count ?? 0}
              sub={`${stats?.chunk_count.toLocaleString('sv-SE') ?? 0} chunks totalt`}
              icon={<Library size={14} weight="bold" />}
              tone="neutral"
            />
          </div>
          <div className="col-span-6 lg:col-span-4">
            <StatCard
              label="Kretskampen-omgångar"
              value={stats?.quiz_scores_total ?? 0}
              sub="spelomgångar spelade"
              icon={<Trophy size={14} weight="bold" />}
              tone="success"
            />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <StatCard
              label="Senaste 7 dagar"
              value={stats?.questions_last_7d ?? 0}
              sub={`${stats?.unanswered_last_7d ?? 0} av dem obesvarade`}
              icon={<TrendingUp size={14} weight="bold" />}
              tone="brand"
            />
          </div>
        </div>

        {/* BENTO row — asymmetric content cards */}
        <div className="grid grid-cols-12 gap-5">
          {/* Unanswered — wide */}
          <div className="col-span-12 lg:col-span-8">
            <Card variant="glass" className="p-6 h-full">
              <SectionHeader
                icon={<CircleHelp size={14} weight="bold" />}
                tone="warning"
                title="Senaste obesvarade"
                subtitle="Frågor som inte kunde besvaras — visa Linnea att fylla luckan"
              />
              {unanswered.length === 0 ? (
                <EmptyState text="Inga obesvarade frågor än. AI:n klarar alla frågor med nuvarande kunskapsbas." />
              ) : (
                <ul className="space-y-2">
                  {unanswered.map((row) => (
                    <li key={row.id} className="p-3.5 rounded-xl bg-white border border-ink-100 hover:border-amber-200 hover:bg-amber-50/40 transition-colors">
                      <p className="text-[13.5px] font-semibold text-ink-900 leading-snug">
                        {row.question_text}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 flex-wrap">
                        <span>
                          {formatDate(row.created_at, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {row.top_match_similarity != null && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>närmast: {Math.round(row.top_match_similarity * 100)} %</span>
                          </>
                        )}
                        {row.top_match_filename && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="truncate max-w-[240px] normal-case tracking-normal text-ink-500 font-semibold">
                              {row.top_match_filename}
                            </span>
                          </>
                        )}
                        {row.notified && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="text-emerald-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              mail skickat
                            </span>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Top FAQ — narrow tall */}
          <div className="col-span-12 lg:col-span-4">
            <Card variant="glass" className="p-6 h-full">
              <SectionHeader
                icon={<Flame size={14} weight="bold" />}
                tone="warning"
                title="Populärast"
                subtitle="Mest ställda frågor"
              />
              {topFaqs.length === 0 ? (
                <EmptyState text="Inga frågor än — börja chatta." />
              ) : (
                <ul className="space-y-1.5">
                  {topFaqs.map((faq, i) => (
                    <li
                      key={faq.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-ink-100 hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
                    >
                      <span
                        className={cn(
                          'w-7 h-7 rounded-lg inline-flex items-center justify-center font-display text-sm shrink-0 tabular-nums',
                          i === 0
                            ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                            : i < 3
                              ? 'bg-ink-100 text-ink-700'
                              : 'bg-ink-50 text-ink-400',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-[12px] font-semibold text-ink-700 truncate">
                        {faq.question_text}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 tabular-nums">
                        {faq.count}×
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        {/* Sources row — full width with nicer bars */}
        <Card variant="glass" className="p-6">
          <SectionHeader
            icon={<Database size={14} weight="bold" />}
            tone="neutral"
            title="Största källor"
            subtitle="Dokument med flest indexerade chunks — visar vilka som driver AI:ns svar"
          />

          {topSources.length === 0 ? (
            <EmptyState text="Inga källor än." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {topSources.map((src, i) => {
                const maxChunks = topSources[0]?.chunk_count || 1;
                const pct = (src.chunk_count / maxChunks) * 100;
                const isUrl =
                  src.filename.includes('/') ||
                  src.filename.includes('.se') ||
                  src.filename.includes('.eu');
                const displayName = isUrl ? src.filename : src.filename.replace(/\.[^/.]+$/, '');
                return (
                  <div key={src.filename}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-ink-400 tabular-nums w-6 shrink-0">
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink-700 truncate"
                        title={src.filename}
                      >
                        {displayName}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-ink-800 tabular-nums">
                        {src.chunk_count}
                      </span>
                    </div>
                    <div className="h-2 bg-ink-100/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function HeroCard({
  label,
  value,
  subValue,
  subLabel,
  delta,
  deltaLabel,
  icon,
  tone,
  compact,
}: {
  label: string;
  value: number;
  subValue: number | null;
  subLabel: string;
  delta: number;
  deltaLabel: string;
  icon: ReactNode;
  tone: 'brand' | 'warning' | 'success';
  compact?: boolean;
}) {
  const bg = {
    brand: 'bg-gradient-to-br from-white via-brand-50/50 to-brand-100/40 border-brand-100',
    warning: 'bg-gradient-to-br from-amber-50/80 via-amber-50/60 to-white border-amber-200',
    success: 'bg-gradient-to-br from-white via-emerald-50/40 to-emerald-50/30 border-emerald-100',
  }[tone];
  const accent = {
    brand: 'text-brand-700',
    warning: 'text-amber-800',
    success: 'text-emerald-700',
  }[tone];

  return (
    <div className={cn('h-full rounded-3xl border p-8 shadow-card relative overflow-hidden', bg)}>
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-8">
          <IconTile size="sm" tone={tone === 'brand' ? 'brand' : tone} icon={icon} />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
            {label}
          </span>
        </div>

        <div className="flex-1 flex items-end">
          <div>
            <p
              className={cn(
                'text-display leading-none tabular-nums',
                compact ? 'text-6xl' : 'text-7xl',
                accent,
              )}
            >
              {value.toLocaleString('sv-SE')}
            </p>
            {subValue != null && (
              <p className="text-[13px] font-semibold text-ink-500 mt-3">
                <span className="text-ink-800 tabular-nums">{subValue.toLocaleString('sv-SE')}</span>{' '}
                {subLabel}
              </p>
            )}
            {subValue == null && subLabel && (
              <p className="text-[13px] font-semibold text-ink-500 mt-3">{subLabel}</p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-ink-100/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px]">
            <TrendingUp size={14} className={accent} weight="bold" />
            <span className="font-semibold text-ink-700 tabular-nums">
              {delta.toLocaleString('sv-SE')}
            </span>
            <span className="text-ink-500">{deltaLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  icon: ReactNode;
  tone: 'brand' | 'neutral' | 'success' | 'warning';
}) {
  return (
    <Card variant="glass" className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <IconTile size="sm" tone={tone} icon={icon} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500 truncate">
          {label}
        </span>
      </div>
      <p className="text-display text-4xl text-ink-900 leading-none tabular-nums">
        {value.toLocaleString('sv-SE')}
      </p>
      <p className="text-[11.5px] font-semibold text-ink-400 mt-2">{sub}</p>
    </Card>
  );
}

function SectionHeader({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: ReactNode;
  tone: 'brand' | 'warning' | 'neutral' | 'success';
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <IconTile size="sm" tone={tone} icon={icon} />
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-ink-900 text-[15px] leading-none">{title}</h3>
        <p className="text-[11.5px] font-semibold text-ink-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-[13px] text-ink-400 text-center py-8 font-medium">{text}</p>;
}
