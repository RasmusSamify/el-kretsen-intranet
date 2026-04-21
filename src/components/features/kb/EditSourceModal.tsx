import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Save } from 'lucide-react';
import { Button, Modal, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { adminGetSource, adminUpdateSource } from '@/lib/api';

interface EditSourceModalProps {
  open: boolean;
  filename: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditSourceModal({ open, filename, onClose, onSaved }: EditSourceModalProps) {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [chunkCount, setChunkCount] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ chunks: number } | null>(null);

  useEffect(() => {
    if (!open || !filename) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setContent('');
    setWarning(null);

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Ingen aktiv session — logga in igen');
        const result = await adminGetSource(filename, token);
        if (cancelled) return;
        setContent(result.content);
        setOriginal(result.content);
        setChunkCount(result.chunk_count);
        setWarning(result.warning);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, filename]);

  const close = () => {
    if (saving) return;
    setContent('');
    setOriginal('');
    setWarning(null);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const save = async () => {
    if (!filename || saving || !content.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ingen aktiv session');
      const result = await adminUpdateSource(filename, content, token);
      setSuccess({ chunks: result.chunks });
      setOriginal(content);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const dirty = content !== original;
  const canSave = dirty && content.trim().length >= 100 && !saving;

  return (
    <Modal open={open} onClose={close} title={`Redigera ${filename ?? ''}`} size="xl">
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size={24} className="text-brand-500" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-500">
                <FileText size={13} strokeWidth={1.75} />
                <span>{chunkCount} chunks i databasen</span>
                <span className="opacity-40">·</span>
                <span className="tabular-nums">{content.length.toLocaleString('sv-SE')} tecken</span>
                {dirty && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 ml-2">
                    Osparade ändringar
                  </span>
                )}
              </div>
            </div>

            {warning && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle size={14} strokeWidth={2} className="text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-900 leading-relaxed">{warning}</p>
              </div>
            )}

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={saving}
              rows={20}
              className="w-full min-h-[480px] bg-white border border-ink-200 rounded-2xl px-4 py-3 text-[13px] font-mono leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-ink-900 focus:ring-2 focus:ring-ink-100 focus:outline-none transition-all resize-y"
              placeholder="Textinnehåll…"
            />

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[13px] text-red-700 leading-snug">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[13px] text-emerald-800 leading-snug">
                  <strong>Sparad.</strong> {success.chunks} chunks re-embedded via Voyage.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={close} disabled={saving}>
                Stäng
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={!canSave}
                loading={saving}
                leftIcon={<Save size={14} strokeWidth={2} />}
              >
                Spara + re-indexera
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
