import { useEffect, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  ListChecks,
  MessageSquareText,
  NotebookPen,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button, Card, IconTile, Spinner } from '@/components/ui';
import {
  createMeetingLog,
  deleteMeetingLog,
  listMeetingLogs,
  type MeetingLog,
} from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

type LogType = 'meeting' | 'feedback';

export function LoggbokPage() {
  const [items, setItems] = useState<MeetingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<LogType>('meeting');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | LogType>('all');

  const load = async () => {
    setLoading(true);
    try {
      const r = await listMeetingLogs();
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (text.trim().length < 10 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createMeetingLog(type, text.trim());
      setText('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Ta bort posten permanent?')) return;
    try {
      await deleteMeetingLog(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const shown = items.filter((i) => filter === 'all' || i.type === filter);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1100px] mx-auto pb-10 space-y-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <NotebookPen size={30} strokeWidth={1.5} className="text-ink-800" />
            <div>
              <h1 className="text-display text-3xl text-ink-900 leading-none">Loggbok</h1>
              <p className="text-[12px] font-semibold text-ink-400 mt-1">
                Intern logg för möten, samtal och feedback · AI strukturerar och sammanfattar
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
            <Sparkles size={12} strokeWidth={1.75} />
            <span>Endast admin</span>
          </div>
        </header>

        {/* Composer */}
        <Card variant="glass" className="p-6">
          <div className="flex items-center gap-2 mb-3.5">
            <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-ink-100/60 border border-ink-100 shadow-inner-soft">
              <TypeTab active={type === 'meeting'} onClick={() => setType('meeting')} icon={<ClipboardList size={14} strokeWidth={2} />} label="Möte / samtal" />
              <TypeTab active={type === 'feedback'} onClick={() => setType('feedback')} icon={<MessageSquareText size={14} strokeWidth={2} />} label="Feedback" />
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={
              type === 'meeting'
                ? 'Klistra in mötesanteckningar eller en samtalslogg… AI:n drar ut sammanfattning, nyckelpunkter, action points och ett utkast till uppföljning.'
                : 'Skriv eller klistra in feedback… AI:n sammanfattar och plockar ut det viktigaste.'
            }
            className="w-full resize-y p-4 rounded-2xl bg-white border border-ink-200 text-[14px] text-ink-900 placeholder:text-ink-400 leading-relaxed focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none transition-all"
          />

          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-[11px] font-semibold text-ink-400">
              {text.length > 0 && `${text.length} tecken`}
            </span>
            <Button
              onClick={save}
              loading={saving}
              disabled={text.trim().length < 10}
              leftIcon={<Sparkles size={16} strokeWidth={2.25} />}
            >
              Spara & sammanfatta
            </Button>
          </div>
          {error && (
            <p className="text-[12.5px] text-red-700 font-medium mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label={`Alla (${items.length})`} />
          <FilterTab active={filter === 'meeting'} onClick={() => setFilter('meeting')} label="Möten" />
          <FilterTab active={filter === 'feedback'} onClick={() => setFilter('feedback')} label="Feedback" />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={22} className="text-brand-500" />
          </div>
        ) : shown.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <IconTile icon={<NotebookPen size={20} strokeWidth={2} />} tone="neutral" size="lg" />
            <h3 className="text-display text-2xl text-ink-900 mt-4 mb-2">Inga poster än</h3>
            <p className="text-[13px] text-ink-500 max-w-md mx-auto leading-relaxed">
              Klistra in ett möte eller en feedback ovan och spara — så samlas allt här,
              sammanfattat och sökbart.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {shown.map((item) => (
              <LogCard key={item.id} item={item} onDelete={() => remove(item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap',
        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all',
        active ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:border-ink-400',
      )}
    >
      {label}
    </button>
  );
}

function LogCard({ item, onDelete }: { item: MeetingLog; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyFollowup = async () => {
    if (!item.draft_followup) return;
    try {
      await navigator.clipboard.writeText(item.draft_followup);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const isFeedback = item.type === 'feedback';

  return (
    <Card variant="glass" className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-5 hover:bg-ink-50/40 transition-colors">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'shrink-0 mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
              isFeedback ? 'bg-violet-100 text-violet-800' : 'bg-brand-100 text-brand-800',
            )}
          >
            {isFeedback ? <MessageSquareText size={11} strokeWidth={2.5} /> : <ClipboardList size={11} strokeWidth={2.5} />}
            {isFeedback ? 'Feedback' : 'Möte'}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14.5px] font-bold text-ink-900 leading-snug">{item.title}</h3>
            {item.summary && !open && (
              <p className="text-[12.5px] text-ink-500 mt-1 leading-snug line-clamp-2">{item.summary}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              <span>
                {formatDate(item.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {item.author_email && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="normal-case tracking-normal text-ink-400">{item.author_email}</span>
                </>
              )}
            </div>
          </div>
          <ChevronDown size={18} strokeWidth={2} className={cn('shrink-0 text-ink-400 transition-transform mt-0.5', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-ink-100 space-y-4">
          {item.summary && (
            <div className="pt-3">
              <SectionLabel>Sammanfattning</SectionLabel>
              <p className="text-[13px] text-ink-800 leading-relaxed">{item.summary}</p>
            </div>
          )}

          {item.key_points.length > 0 && (
            <div>
              <SectionLabel>Nyckelpunkter</SectionLabel>
              <ul className="space-y-1">
                {item.key_points.map((p, i) => (
                  <li key={i} className="text-[13px] text-ink-700 flex items-start gap-2 leading-snug">
                    <span className="text-brand-500 mt-1.5 w-1 h-1 rounded-full bg-brand-500 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.action_items.length > 0 && (
            <div>
              <SectionLabel>
                <ListChecks size={11} strokeWidth={2.5} className="inline mr-1 -mt-0.5" />
                Action points
              </SectionLabel>
              <ul className="space-y-1.5">
                {item.action_items.map((a, i) => (
                  <li key={i} className="text-[13px] text-ink-800 flex items-start gap-2 leading-snug p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                    <Check size={13} strokeWidth={2.5} className="text-amber-600 mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.draft_followup && (
            <div>
              <div className="flex items-center justify-between">
                <SectionLabel>Utkast till uppföljning</SectionLabel>
                <button
                  onClick={copyFollowup}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-600 hover:text-brand-800 transition-colors"
                >
                  {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
                  {copied ? 'Kopierat' : 'Kopiera'}
                </button>
              </div>
              <p className="text-[12.5px] text-ink-700 leading-relaxed whitespace-pre-wrap rounded-xl bg-white border border-ink-100 p-3.5">
                {item.draft_followup}
              </p>
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-ink-400 hover:text-ink-700 transition-colors">
              Visa originaltext
            </summary>
            <p className="text-[12px] text-ink-500 leading-relaxed whitespace-pre-wrap mt-2 rounded-xl bg-ink-50/70 border border-ink-100 p-3.5">
              {item.raw_text}
            </p>
          </details>

          <div className="pt-1">
            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={14} strokeWidth={1.75} />} onClick={onDelete}>
              Ta bort
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-black uppercase tracking-wider text-ink-400 mb-1.5">{children}</p>;
}
