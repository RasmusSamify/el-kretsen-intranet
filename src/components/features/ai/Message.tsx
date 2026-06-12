import { useState } from 'react';
import { Sparkles, User, ShieldAlert, AlertCircle } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';
import { IconTile } from '@/components/ui';
import { MessageContent } from './MessageContent';
import { CorrectionModal } from './CorrectionModal';
import { cn } from '@/lib/utils';

interface MessageProps {
  message: ChatMessage;
  question?: string;
  /** True medan detta (sista) assistent-svar fortfarande strömmas in. */
  isStreaming?: boolean;
}

export function Message({ message, question, isStreaming }: MessageProps) {
  const isUser = message.role === 'user';
  const isUngrounded = !isUser && message.grounded === false;
  const [correctionOpen, setCorrectionOpen] = useState(false);

  return (
    <div className={cn('flex gap-3 animate-slide-up', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <IconTile
          size="sm"
          tone={isUngrounded ? 'warning' : 'brand'}
          icon={isUngrounded ? <ShieldAlert size={14} strokeWidth={2.25} /> : <Sparkles size={14} strokeWidth={2.25} />}
        />
      )}

      <div
        className={cn(
          'max-w-[85%]',
          isUser
            ? 'px-4 py-3 rounded-2xl rounded-br-md text-white text-[14px] font-medium shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_18px_-10px_rgba(3,105,161,0.5)]'
            : 'px-5 py-4 rounded-2xl rounded-bl-md bg-white border border-ink-100 shadow-card',
        )}
        style={isUser ? { background: 'var(--brand-gradient)' } : undefined}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <MessageContent text={message.content} citations={message.citations} streaming={isStreaming} />
        )}

        {!isUser && message.sourceFiles && message.sourceFiles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ink-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 mr-1">Källor</span>
            {message.sourceFiles.map((f) => (
              <span
                key={f}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-ink-50 border border-ink-100 text-[11px] font-semibold text-ink-600"
              >
                {f.replace(/\.[^/.]+$/, '')}
              </span>
            ))}
          </div>
        )}

        {!isUser && question && !isStreaming && (
          <div className="mt-2 -mb-1 flex justify-end">
            <button
              type="button"
              onClick={() => setCorrectionOpen(true)}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-400 hover:text-amber-700 transition-colors"
              title="Hjälp ELvis att svara rätt nästa gång"
            >
              <AlertCircle size={11} strokeWidth={2} />
              Rätta detta svar
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <IconTile size="sm" tone="neutral" icon={<User size={14} strokeWidth={2.25} />} />
      )}

      {!isUser && question && (
        <CorrectionModal
          open={correctionOpen}
          question={question}
          originalAnswer={message.content}
          citedSources={message.sourceFiles ?? []}
          onClose={() => setCorrectionOpen(false)}
          onSubmitted={() => {
            // Modal visar success-läge själv; stäng efter en stund
            setTimeout(() => setCorrectionOpen(false), 2500);
          }}
        />
      )}
    </div>
  );
}
