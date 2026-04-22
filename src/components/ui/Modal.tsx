import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}

const sizes = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

export function Modal({ open, onClose, title, children, size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className="absolute inset-0 bg-ink-900/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up', sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
            <h3 id="modal-title" className="font-bold text-ink-900 text-lg">{title}</h3>
            <button
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-ink-900 hover:bg-ink-100 transition-colors"
              aria-label="Stäng"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
