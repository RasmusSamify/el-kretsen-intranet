import { useRef, useState, type KeyboardEvent, type ChangeEvent } from 'react';
import { Paperclip, Send, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComposerProps {
  onSend: (text: string, attached: string | null) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [attached, setAttached] = useState<{ name: string; content: string } | null>(null);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim(), attached?.content ?? null);
    setValue('');
    setAttached(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let content = await file.text();
      if (content.length > 8000) content = content.slice(0, 8000) + '\n[...trunkerad]';
      setAttached({ name: file.name, content });
    } catch {
      // Ignore read errors
    }
  };

  return (
    <div className="border-t border-ink-100 bg-ink-50/40 backdrop-blur p-4">
      {attached && (
        <div className="mb-3 p-3 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-brand-600 shrink-0" strokeWidth={2.25} />
            <span className="text-xs font-bold text-brand-700 truncate">{attached.name}</span>
          </div>
          <button
            onClick={() => {
              setAttached(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-brand-600 hover:text-red-600 shrink-0"
            aria-label="Ta bort bifogad fil"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label
          className={cn(
            'shrink-0 w-11 h-11 rounded-xl border-2 border-dashed border-ink-200',
            'flex items-center justify-center cursor-pointer transition-colors group',
            'hover:border-brand-400 hover:bg-brand-50',
            disabled && 'opacity-40 cursor-not-allowed',
          )}
          title="Bifoga fil (TXT/CSV/PDF)"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.pdf,.md"
            className="hidden"
            onChange={handleFile}
            disabled={disabled}
          />
          <Paperclip size={18} strokeWidth={2.25} className="text-ink-400 group-hover:text-brand-600 transition-colors" />
        </label>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 140) + 'px';
          }}
          onKeyDown={handleKey}
          placeholder="Ställ en fråga om producentansvar, batterikoder eller avfallshantering…"
          disabled={disabled}
          className={cn(
            'flex-1 resize-none bg-white border border-ink-200 rounded-2xl px-4 py-3 text-[14px]',
            'font-medium text-ink-900 placeholder:text-ink-400 shadow-inner-soft',
            'focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none',
            'transition-all duration-200 max-h-36 overflow-y-auto',
          )}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={cn(
            'shrink-0 w-11 h-11 rounded-xl text-white inline-flex items-center justify-center',
            'transition-all duration-200 shadow-md',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'hover:-translate-y-[1px] hover:shadow-lg',
          )}
          style={{ background: 'var(--brand-gradient)' }}
          aria-label="Skicka fråga"
        >
          <Send size={17} strokeWidth={2.25} />
        </button>
      </div>

      <p className="mt-2.5 text-[10px] text-center font-semibold tracking-wider uppercase text-ink-400">
        Svaren baseras på El-kretsens kunskapsbank · Enter skickar, Shift + Enter ger radbrytning
      </p>
    </div>
  );
}
