import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, FileText, Upload } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { ingestFile, type IngestFileResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AddFileModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

const MAX_FILE_BYTES = 1_500_000; // 1.5 MB

export function AddFileModal({ open, onClose, onAdded }: AddFileModalProps) {
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<IngestFileResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (loading) return;
    setFilename('');
    setContent('');
    setError(null);
    setSuccess(null);
    setDragOver(false);
    onClose();
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`Filen är för stor (${(file.size / 1024).toFixed(0)} KB). Max ${MAX_FILE_BYTES / 1024} KB.`);
      return;
    }
    const name = file.name.replace(/\.[^/.]+$/, '');
    if (!filename) setFilename(name);
    try {
      const text = await file.text();
      setContent(text);
    } catch (e) {
      setError(`Kunde inte läsa filen: ${(e as Error).message}`);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!filename.trim() || !content.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await ingestFile(filename.trim(), content);
      setSuccess(result);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Ladda upp fil till kunskapsbasen" size="lg">
      <form onSubmit={submit} className="p-6 space-y-5">
        {!success && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all',
              dragOver
                ? 'border-ink-900 bg-ink-50'
                : 'border-ink-200 hover:border-ink-400 hover:bg-ink-50/60',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={onFileChange}
            />
            <Upload size={26} strokeWidth={1.5} className="mx-auto text-ink-500 mb-3" />
            <p className="text-[14px] font-bold text-ink-900">
              Släpp en TXT-fil här eller klicka för att välja
            </p>
            <p className="text-[12px] text-ink-500 mt-1">
              Max 1 500 KB · endast ren text (.txt, .md)
            </p>
            {content && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[12px] font-semibold text-emerald-800">
                <FileText size={13} strokeWidth={2} />
                {content.length.toLocaleString('sv-SE')} tecken inlästa
              </div>
            )}
          </div>
        )}

        {!success && content && (
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-2">
              Filnamn i kunskapsbasen
            </label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="T.ex. Interna_rutiner_2026"
              disabled={loading}
            />
            <p className="text-[11px] text-ink-400 mt-1.5">
              Filen sparas som <strong>{filename || 'namn'}.txt</strong> i databasen och visas i källistan.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[13px] text-red-700 leading-snug">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2} />
            <div className="text-[13px] text-emerald-800 leading-snug">
              <strong className="font-bold">Indexering klar!</strong>
              <div className="text-[12px] font-semibold text-emerald-700 mt-1">
                {success.chunks} chunks · {success.tokens.toLocaleString('sv-SE')} tokens · sparad som{' '}
                <code className="px-1.5 py-0.5 bg-white rounded border border-emerald-200">
                  {success.source}
                </code>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close} disabled={loading}>
            {success ? 'Stäng' : 'Avbryt'}
          </Button>
          {!success && (
            <Button type="submit" loading={loading} disabled={!filename.trim() || !content.trim()}>
              Indexera filen
            </Button>
          )}
          {success && (
            <Button
              type="button"
              onClick={() => {
                setFilename('');
                setContent('');
                setSuccess(null);
                setError(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Ladda upp en till
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
