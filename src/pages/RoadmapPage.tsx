import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  GraduationCap,
  PenLine,
  Radar,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { Card, IconTile } from '@/components/ui';
import { cn } from '@/lib/utils';

const LAST_UPDATED = '30 maj 2026';

type Status = 'next' | 'planned' | 'exploring';

interface RoadmapItem {
  icon: ReactNode;
  title: string;
  description: string;
  status: Status;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  next: { label: 'Näst på tur', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  planned: { label: 'Planerad', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  exploring: { label: 'Under utredning', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
};

const ITEMS: RoadmapItem[] = [
  {
    icon: <PenLine size={18} strokeWidth={1.75} />,
    title: 'Skrivelse-assistent',
    description:
      'Generera färdiga producentbrev, deadline-påminnelser och begripliga sammanfattningar av regler — på sekunder och grundat i kunskapsbasen. Som Elvira, fast för utgående utskick.',
    status: 'next',
  },
  {
    icon: <Radar size={18} strokeWidth={1.75} />,
    title: 'Regelradar — automatisk lagbevakning',
    description:
      'Bevakar att de lagar och EU-direktiv ni stödjer er på inte ändrats. När något ändras får ni en notis med en begriplig sammanfattning av vad det innebär — så inget glider er förbi.',
    status: 'planned',
  },
  {
    icon: <GraduationCap size={18} strokeWidth={1.75} />,
    title: 'Introduktion för nya medarbetare',
    description:
      'En guidad läranväg byggd på Kretskampen som snabbt gör nyanställda trygga i producentansvar, batterier och WEEE — med tydlig progress.',
    status: 'exploring',
  },
];

export function RoadmapPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1000px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Rocket size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">På gång</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Vad vi planerar härnäst för ELvis Hub
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-ink-400">
            Senast uppdaterad {LAST_UPDATED}
          </span>
        </header>

        {/* Intro */}
        <Card variant="glass" className="p-6 bg-gradient-to-br from-white via-brand-50/40 to-brand-100/30 border-brand-100">
          <div className="flex items-start gap-3">
            <IconTile icon={<Sparkles size={16} strokeWidth={2.25} />} tone="brand" size="md" />
            <div>
              <h2 className="text-display text-xl text-ink-900 leading-tight mb-1.5">
                Vi bygger ELvis Hub vidare tillsammans
              </h2>
              <p className="text-[13.5px] text-ink-600 leading-relaxed max-w-2xl">
                Här ser ni vad som är på väg. Listan uppdateras löpande utifrån era behov — har ni
                önskemål eller idéer, hör gärna av er via <strong className="text-ink-800">Feedback</strong>-knappen
                uppe till höger.
              </p>
            </div>
          </div>
        </Card>

        {/* Items */}
        <div className="space-y-3">
          {ITEMS.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <Card key={item.title} variant="glass" className="p-5">
                <div className="flex items-start gap-4">
                  <IconTile icon={item.icon} tone="neutral" size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                      <h3 className="text-[15px] font-bold text-ink-900 leading-tight">{item.title}</h3>
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                          meta.cls,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer note */}
        <Card variant="glass" className="p-5">
          <div className="flex items-center gap-3">
            <IconTile icon={<ArrowUpRight size={15} strokeWidth={2} />} tone="success" size="sm" />
            <p className="text-[12.5px] text-ink-600 leading-relaxed">
              Nyss släppt: Elvira (mail-assistenten), Kunskapsluckor och Systemstatus. Se allt vi
              lagt till i <strong className="text-ink-800">uppdaterings­historiken</strong> — klicka
              på versionen längst ner i menyn.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
