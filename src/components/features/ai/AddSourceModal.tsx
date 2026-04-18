import { useState, type FormEvent } from 'react';
import { Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Input, Modal, IconTile } from '@/components/ui';
import { ingestUrl, type IngestUrlResponse } from '@/lib/api';

interface AddSourceModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddSourceModal({ open, onClose, onAdded }: AddSourceModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<IngestUrlResponse | null>(null);

  const close = () => {
    if (loading) return;
    setUrl('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await ingestUrl(url.trim());
      setSuccess(result);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Lägg till URL i kunskapsbasen" size="md">
      <form onSubmit={submit} className="p-6 space-y-5">
        <div className="flex gap-3">
          <IconTile icon={<Link2 size={16} strokeWidth={2.25} />} tone="brand" size="md" />
          <div className="flex-1">
            <p className="text-[13px] text-ink-700 leading-relaxed">
              Klistra in en URL så hämtar systemet sidan, extraherar text och indexerar den semantiskt.
              Innehållet kan sedan användas som källa av ELvis.
            </p>
            <p className="text-[11px] text-ink-400 mt-2">
              Observera: JS-renderat innehåll (t.ex. SPA:er) kan inte skrapas. Statiska sidor funkar bäst.
            </p>
          </div>
        </div>

        <div>
          <label className="text-eyebrow block mb-2">Webbadress</label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://naturvardsverket.se/..."
            required
            disabled={loading}
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2.25} />
            <p className="text-[13px] text-red-700 leading-snug">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.25} />
            <div className="text-[13px] text-emerald-800 leading-snug">
              <strong className="font-bold">Indexering klar.</strong>
              {success.title && <span> &quot;{success.title}&quot; sparad.</span>}
              <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                {success.chunks} chunks · {success.tokens} tokens · källa: {success.source}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close} disabled={loading}>
            {success ? 'Stäng' : 'Avbryt'}
          </Button>
          {!success && (
            <Button type="submit" loading={loading} disabled={!url.trim()}>
              Indexera sidan
            </Button>
          )}
          {success && (
            <Button
              type="button"
              onClick={() => {
                setUrl('');
                setSuccess(null);
                setError(null);
              }}
            >
              Lägg till en till
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
