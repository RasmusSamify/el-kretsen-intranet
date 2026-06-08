import type { ReactNode } from 'react';
import {
  Lightbulb,
  Target,
  Gauge,
  Globe,
  ShieldCheck,
  Bot,
  FolderTree,
  Hash,
  ListChecks,
  Check,
  Phone,
} from 'lucide-react';
import { Card, Badge, IconTile } from '@/components/ui';

/**
 * Internt underlag (endast admin) inför El-kretsens beslut om att utöka
 * kunskapsbasen med externa webbsidor. Reducerad sammanfattning av Samifys
 * analys — tänkt att visas för Linnea inför avstämningen.
 *
 * Siffror är en ögonblicksbild per 2026-06-08 (live ur Elvis-databasen).
 */

// ── Ögonblicksbild idag (live ur kb_sources / kb_chunks_v2, 2026-06-08) ──
const SNAPSHOT_DATE = '8 juni 2026';

// ── Sajterna El-kretsen önskat (sidantal från respektive sitemap) ──
interface SiteRow {
  name: string;
  pages: string;
  recommendation: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  phase: '1' | '2';
}

const SITES: SiteRow[] = [
  { name: 'sopor.nu', pages: '~397', recommendation: 'Ta — men gallra nyhetsarkivet (~130 sidor)', tone: 'warning', phase: '1' },
  { name: 'naturvardsverket.se', pages: '2', recommendation: 'Producentansvar el-utrustning + batterier — ni har redan scopat det själva, perfekt', tone: 'success', phase: '1' },
  { name: 'kunskapsrummet.se', pages: '~12', recommendation: 'Ta hela — litet', tone: 'success', phase: '1' },
  { name: 'verksamhetsavfall.se', pages: '~12', recommendation: 'Ta hela — litet och relevant', tone: 'success', phase: '1' },
  { name: 'avfallsverige.se', pages: '~825', recommendation: 'Ta vettat — väg in det gamla rapportarkivet', tone: 'warning', phase: '1' },
  { name: 'weee-forum.org', pages: 'varierar', recommendation: 'Fas 2 — efter att fas 1 är bevisad', tone: 'neutral', phase: '2' },
  { name: 'pronexa.com', pages: 'varierar', recommendation: 'Fas 2', tone: 'neutral', phase: '2' },
  { name: 'eucobat.eu', pages: 'varierar', recommendation: 'Fas 2', tone: 'neutral', phase: '2' },
  { name: 'handelskammer.se', pages: '1', recommendation: 'Fas 2 — sidan om miljörapportering', tone: 'neutral', phase: '2' },
];

// ── Tre scenarier ──
interface Scenario {
  key: string;
  label: string;
  badge: string;
  tone: 'brand' | 'warning' | 'success';
  total: string;
  breakdown: string;
  chunks: string;
  note: string;
}

const SCENARIOS: Scenario[] = [
  {
    key: 'today',
    label: 'Elvis idag',
    badge: 'NULÄGE',
    tone: 'brand',
    total: '148 källor',
    breakdown: '124 hemsidor + 24 dokument',
    chunks: '~6 500 textstycken',
    note: 'De 24 dokumenten är 9 lagtexter + 15 interna dokument. Balanserat — lagtexterna är ryggraden, hemsidorna ett komplement.',
  },
  {
    key: 'all',
    label: 'Skrapa allt rakt av',
    badge: 'OGALLRAT',
    tone: 'warning',
    total: '~1 900 källor',
    breakdown: '~1 875 hemsidor + 24 dokument',
    chunks: '~19 000 textstycken',
    note: 'De 148 idag + ~1 750 nya hemsidor, ogallrat — inkl. nyhetsarkiv och dubbletter. Hemsidorna dominerar stort och de 24 dokumenten dränks i bruset. (Men: inte långsammare, se ovan.)',
  },
  {
    key: 'plan',
    label: 'Vårt förslag',
    badge: 'REKOMMENDERAS',
    tone: 'success',
    total: '~1 350 källor',
    breakdown: '~1 325 hemsidor + 24 dokument',
    chunks: '~13 000 textstycken',
    note: 'De 148 idag + ~1 200 vettade hemsidor. Samma sajter men gallrat och AI-granskat; lagtexter och interna dokument förblir den nivå Elvis litar på främst.',
  },
];

// ── De tre feedback-punkterna och hur vi löser dem ──
interface Solution {
  icon: ReactNode;
  title: string;
  feedback: string;
  solution: string;
}

const SOLUTIONS: Solution[] = [
  {
    icon: <Globe size={16} strokeWidth={2} />,
    title: '1 · Lägga in hela webbplatser',
    feedback: 'Idag måste man klistra in en webbadress i taget. Ni vill kunna lägga in hela webbplatser på en gång.',
    solution:
      'Ni pekar bara ut en webbplats, så hämtar systemet sidorna åt er. Innan något sparas läser AI:n igenom varje sida och sållar — menyer, reklam och gammalt skräp åker bort, och om en sida säger emot lagen lyfts den till er för en titt. Ni får in massor av innehåll utan att behöva läsa och välja sida för sida själva.',
  },
  {
    icon: <FolderTree size={16} strokeWidth={2} />,
    title: '2 · Ordning och styrning',
    feedback: 'Innehåll kommer från olika avdelningar men alla behöver det. Och ni vill kunna påverka vad Elvis svarar utifrån.',
    solution:
      'Varje dokument får en avdelnings-etikett som visar vem som äger och håller det uppdaterat — alla läser ändå allt. Samma etikett blir en valfri filterknapp: vill ni ha ett mer kontrollerat svar kan ni be Elvis svara utifrån t.ex. bara en avdelnings material eller bara lagtexterna. Som standard söker Elvis i allt, precis som idag.',
  },
  {
    icon: <Hash size={16} strokeWidth={2} />,
    title: '3 · Vad siffran betyder',
    feedback: 'Ni undrade vad siffran i referensrutan betyder — klickar man på "8" ser man ändå bara ett textstycke.',
    solution:
      'Siffran är bara en numrering av källorna i svaret — "8" betyder "den åttonde källan Elvis hänvisade till", precis som fotnoter i en bok. Den säger inget om hur bra eller hur långt stycket är. Vi gör det tydligare genom att skriva ut "Källa nr 8" och visa källans namn, så att det inte känns som en gåta.',
  },
];

// ── Beslut för samtalet ──
const DECISIONS: string[] = [
  'Scope/policy: ska nyhetsartiklar, gamla rapporter och engelskspråkiga sidor med — eller bara fakta/vägledning?',
  'Naturvårdsverket: okej att scopa till producentansvars-delen? (Vi avråder från hela myndighetssajten.)',
  'Autonomi: ska en människa godkänna gränsfall i Granskning i början, tills pipen är bevisad? (Rekommenderas.)',
  'Ordning: vilka sajter tar vi i fas 1, vilka väntar till fas 2?',
];

export function KunskapsbasForslagPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1100px] mx-auto pb-14 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Lightbulb size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">
                Kunskapsbas — underlag inför samtalet
              </h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1.5">
                Internt · endast admin · sammanställt av Samify · ögonblicksbild {SNAPSHOT_DATE}
              </p>
            </div>
          </div>
          <Badge variant="brand" leftIcon={<ShieldCheck size={12} strokeWidth={2.25} />}>
            För Linnea
          </Badge>
        </header>

        {/* Intro */}
        <Card variant="glass" className="p-6 border">
          <p className="text-[14px] leading-relaxed text-ink-700">
            Ni har önskat att vi skrapar ett antal externa webbplatser till kunskapsbasen, en tydligare
            struktur per avdelning, och svar på vad siffran i referensrutan betyder. Här är vad Elvis
            innehåller idag, vad det skulle bli om vi skrapade allt rakt av, och vårt förslag på vägen
            framåt. Tänkt som underlag att bolla — inget är gjort ännu.
          </p>
        </Card>

        {/* Grundprincip */}
        <Card variant="glass" className="p-6 border border-brand-100 bg-brand-50/30">
          <div className="flex items-start gap-4">
            <IconTile icon={<Target size={18} strokeWidth={2} />} tone="brand" size="lg" />
            <div>
              <h2 className="text-display text-xl text-ink-900 leading-none mb-2">
                Grundprincipen: kunskapen hålls kurerad
              </h2>
              <p className="text-[13.5px] leading-relaxed text-ink-700">
                Elvis styrka ligger i en{' '}
                <strong className="font-bold text-ink-900">kurerad och avgränsad</strong> kunskapsbas —
                varje källa medvetet vald, granskad och källmärkt. Det är just det som gör svaren exakta
                och pålitliga. När vi växer måste vi behålla den kontrollen{' '}
                <strong className="font-bold text-ink-900">hela tiden</strong>: mer innehåll får aldrig
                komma på bekostnad av precisionen. Därför gallrar och granskar vi — i stället för att
                dumpa in allt — så att vi breddar kunskapen utan att tappa skärpan.
              </p>
            </div>
          </div>
        </Card>

        {/* Hastighets-callout */}
        <Card variant="glass" className="p-6 border border-emerald-100 bg-emerald-50/40">
          <div className="flex items-start gap-4">
            <IconTile icon={<Gauge size={18} strokeWidth={2} />} tone="success" size="lg" />
            <div>
              <h2 className="text-display text-xl text-ink-900 leading-none mb-2">
                Blir Elvis långsammare av mer innehåll? Nej.
              </h2>
              <p className="text-[13.5px] leading-relaxed text-ink-700">
                Elvis hämtar alltid bara en handfull av de mest relevanta styckena per fråga, oavsett
                hur stor basen är — och söktekniken (HNSW-index) gör att söktiden knappt påverkas även
                om basen växer tiofalt. Svarstiden är i praktiken densamma. Den verkliga frågan är inte
                hastighet, utan <strong className="font-bold text-ink-900">precision</strong>: dränker vi
                lagtexten i brus blir svaren sämre, inte segare.
              </p>
            </div>
          </div>
        </Card>

        {/* Tre scenarier */}
        <div>
          <h2 className="text-display text-xl text-ink-900 mb-3">Idag vs om vi skrapar allt</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SCENARIOS.map((s) => (
              <Card
                key={s.key}
                variant="glass"
                className={
                  'p-5 border ' +
                  (s.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : s.tone === 'warning'
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-brand-100')
                }
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-[14px] font-bold text-ink-900">{s.label}</h3>
                  <Badge variant={s.tone}>{s.badge}</Badge>
                </div>
                <div className="space-y-1.5 mb-3">
                  <p className="text-[20px] font-bold text-ink-900 leading-none tabular-nums">{s.total}</p>
                  <p className="text-[12.5px] font-semibold text-ink-600">{s.breakdown}</p>
                  <p className="text-[12px] font-semibold text-ink-400">{s.chunks}</p>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-600">{s.note}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Sajter */}
        <div>
          <h2 className="text-display text-xl text-ink-900 mb-3">Sajterna ni önskat</h2>
          <Card variant="glass" className="border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/50">
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">Sajt</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">Sidor</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">Vår rekommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {SITES.map((site) => (
                    <tr key={site.name} className="border-b border-ink-50 last:border-0">
                      <td className="px-4 py-3 align-top">
                        <span className="text-[13px] font-semibold text-ink-800">{site.name}</span>
                        {site.phase === '2' && (
                          <Badge variant="neutral" className="ml-2 align-middle">Fas 2</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-[13px] font-semibold text-ink-600 tabular-nums whitespace-nowrap">
                        {site.pages}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={
                            'text-[12.5px] font-medium ' +
                            (site.tone === 'success'
                              ? 'text-emerald-700'
                              : site.tone === 'danger'
                                ? 'text-red-700'
                                : site.tone === 'neutral'
                                  ? 'text-ink-500'
                                  : 'text-amber-700')
                          }
                        >
                          {site.recommendation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Hur vi gör jobbet åt dem */}
        <Card variant="glass" className="p-6 border">
          <div className="flex items-center gap-3 mb-4">
            <IconTile icon={<Bot size={18} strokeWidth={2} />} tone="brand" size="lg" />
            <div>
              <h2 className="text-display text-xl text-ink-900 leading-none">Vi gör jobbet åt er</h2>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                AI granskar varje sida · människa godkänner gränsfall · lagtext förblir primär
              </p>
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-700">
            Ni behöver inte handplocka sidorna. Crawlern hämtar, AI:n (Opus 4.8) bedömer varje sida —
            är den relevant, saklig, motsäger den inte lagen? Skräp åker aldrig in, konflikter mot
            lagtexten lyfts till Granskning, resten går in rent och källmärkt. Voyage vektoriserar bara
            det som redan godkänts — den bedömer inte kvalitet, det gör Claude.
          </p>
        </Card>

        {/* Tre feedback-punkter */}
        <div>
          <h2 className="text-display text-xl text-ink-900 mb-3">Era tre punkter — enkelt förklarat</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {SOLUTIONS.map((item) => (
              <Card key={item.title} variant="glass" className="p-5 border">
                <div className="flex items-center gap-2.5 mb-3">
                  <IconTile icon={item.icon} tone="neutral" size="sm" />
                  <h3 className="text-[13.5px] font-bold text-ink-900">{item.title}</h3>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Det ni vill</p>
                <p className="text-[12.5px] leading-relaxed text-ink-600 mb-3">{item.feedback}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500 mb-1">Så löser vi det</p>
                <p className="text-[12.5px] leading-relaxed text-ink-700">{item.solution}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Beslut för samtalet */}
        <Card variant="glass" className="p-6 border border-brand-100">
          <div className="flex items-center gap-3 mb-4">
            <IconTile icon={<ListChecks size={18} strokeWidth={2} />} tone="brand" size="lg" />
            <div>
              <h2 className="text-display text-xl text-ink-900 leading-none">Att bestämma på samtalet</h2>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">Fyra vägval — resten sköter vi</p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {DECISIONS.map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  <Check size={16} strokeWidth={2.5} className="text-brand-600" />
                </span>
                <span className="text-[13px] leading-relaxed text-ink-700">{d}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-4 border-t border-ink-100 flex items-center gap-2 text-[12px] font-semibold text-ink-400">
            <Phone size={13} strokeWidth={2} />
            Samify ringer Linnea för att bestämma vägen framåt.
          </div>
        </Card>
      </div>
    </div>
  );
}
