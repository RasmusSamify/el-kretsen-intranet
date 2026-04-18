import { useEffect, useState } from 'react';
import { Flame, Lightbulb, Library, Paperclip, Quote } from 'lucide-react';
import { Card, IconTile, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { FAQEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SourcesList } from './SourcesList';
import { AddSourceModal } from './AddSourceModal';

interface SidePanelProps {
  onPickPrompt: (prompt: string) => void;
}

type TabId = 'sources' | 'faq' | 'tips';

const TABS: Array<{ id: TabId; label: string; icon: typeof Library }> = [
  { id: 'sources', label: 'Källor', icon: Library },
  { id: 'faq', label: 'Populärast', icon: Flame },
  { id: 'tips', label: 'Tips', icon: Lightbulb },
];

const TIPS = [
  {
    icon: <Paperclip size={14} strokeWidth={2.25} />,
    title: 'Bifoga fil',
    body: 'Ladda upp TXT/CSV/PDF för direkt analys mot kunskapsbanken.',
  },
  {
    icon: <Quote size={14} strokeWidth={2.25} />,
    title: 'Klicka på källor',
    body: 'Varje citation öppnar exakt paragraf ur dokumentet som använts.',
  },
  {
    icon: <Library size={14} strokeWidth={2.25} />,
    title: 'Lägg till URL:er',
    body: 'Klistra in en webbadress i Källor-fliken så indexeras sidan automatiskt.',
  },
];

export function SidePanel({ onPickPrompt }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('sources');
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourcesRefreshKey, setSourcesRefreshKey] = useState(0);
  const [addSourceOpen, setAddSourceOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('ai_questions')
      .select('id, question_text, count')
      .order('count', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (!mounted) return;
        setFaqs((data as FAQEntry[]) ?? []);
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-80 shrink-0">
      <Card variant="glass" className="flex-1 flex flex-col overflow-hidden !rounded-3xl">
        {/* Tab bar */}
        <div
          role="tablist"
          className="flex items-center gap-1 p-1.5 m-3 mb-0 rounded-2xl bg-ink-100/60 border border-ink-100 shadow-inner-soft"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all',
                  active
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <Icon size={13} strokeWidth={2.5} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-5 pt-4">
          {activeTab === 'sources' && (
            <SourcesPanel
              refreshKey={sourcesRefreshKey}
              onAdd={() => setAddSourceOpen(true)}
            />
          )}
          {activeTab === 'faq' && (
            <FAQPanel faqs={faqs} loading={loading} onPickPrompt={onPickPrompt} />
          )}
          {activeTab === 'tips' && <TipsPanel />}
        </div>
      </Card>

      <AddSourceModal
        open={addSourceOpen}
        onClose={() => setAddSourceOpen(false)}
        onAdded={() => setSourcesRefreshKey((k) => k + 1)}
      />
    </aside>
  );
}

function SourcesPanel({ refreshKey, onAdd }: { refreshKey: number; onAdd: () => void }) {
  return <SourcesList refreshKey={refreshKey} onAdd={onAdd} embedded />;
}

function FAQPanel({
  faqs,
  loading,
  onPickPrompt,
}: {
  faqs: FAQEntry[];
  loading: boolean;
  onPickPrompt: (prompt: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <IconTile size="sm" tone="warning" icon={<Flame size={14} strokeWidth={2.25} />} />
        <div>
          <h3 className="font-bold text-ink-900 text-sm leading-none">Populärast</h3>
          <p className="text-[11px] font-semibold text-ink-400 mt-0.5">Mest ställda frågor</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner size={18} className="text-brand-500" />
        </div>
      ) : faqs.length === 0 ? (
        <p className="text-xs text-ink-400 text-center py-4 font-medium">Inga frågor ännu — börja chatta!</p>
      ) : (
        <ul className="space-y-2">
          {faqs.map((faq) => (
            <li key={faq.id}>
              <button
                onClick={() => onPickPrompt(faq.question_text)}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-white border border-ink-100 hover:border-brand-400 hover:bg-brand-50/50 transition-all flex items-center justify-between gap-2 group"
              >
                <span className="text-[12px] font-semibold text-ink-700 group-hover:text-brand-700 truncate">
                  {faq.question_text}
                </span>
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                  {faq.count}×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TipsPanel() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <IconTile size="sm" tone="brand" icon={<Lightbulb size={14} strokeWidth={2.25} />} />
        <div>
          <h3 className="font-bold text-ink-900 text-sm leading-none">Tips</h3>
          <p className="text-[11px] font-semibold text-ink-400 mt-0.5">Få ut mer av AI:n</p>
        </div>
      </div>

      <div className="space-y-3">
        {TIPS.map((tip) => (
          <div key={tip.title} className="p-3 rounded-xl bg-white border border-ink-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-brand-600" aria-hidden>
                {tip.icon}
              </span>
              <strong className="text-[12px] font-bold text-ink-900">{tip.title}</strong>
            </div>
            <p className="text-[11.5px] text-ink-600 leading-relaxed">{tip.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
