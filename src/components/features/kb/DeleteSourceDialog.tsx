import { useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { adminDeleteSource } from '@/lib/api';

interface DeleteSourceDialogProps {
  open: boolean;
  filename: string | null;
  chunkCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteSourceDialog({
  open,
  filename,
  chunkCount,
  onClose,
  onDeleted,
}: DeleteSourceDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (deleting) return;
    setConfirmText('');
    setError(null);
    onClose();
  };

  const del = async () => {
    if (!filename || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Ingen aktiv session');
      await adminDeleteSource(filename, token);
      onDeleted();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Ta bort källa" size="md">
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="text-[13px] font-bold text-red-900">Detta går inte att ångra</p>
            <p className="text-[12.5px] text-red-800 leading-relaxed mt-1">
              Alla <strong className="tabular-nums">{chunkCount}</strong> chunks för{' '}
              <code className="px-1 py-0.5 bg-white/60 rounded text-[11.5px]">{filename}</code>{' '}
              raderas från kunskapsbasen. ELvis slutar referera till källan direkt.
            </p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-wider text-ink-500 block mb-2">
            Skriv <code className="px-1 py-0.5 bg-ink-100 rounded text-[11px]">TA BORT</code> för att bekräfta
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={deleting}
            className="w-full h-10 px-3 rounded-xl bg-white border border-ink-200 text-[13px] font-medium text-ink-900 focus:border-red-500 focus:ring-2 focus:ring-red-100 focus:outline-none"
            placeholder="TA BORT"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" strokeWidth={2} />
            <p className="text-[13px] text-red-700 leading-snug">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close} disabled={deleting}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={del}
            disabled={confirmText !== 'TA BORT' || deleting}
            loading={deleting}
            leftIcon={<Trash2 size={14} strokeWidth={2} />}
          >
            Radera permanent
          </Button>
        </div>
      </div>
    </Modal>
  );
}
