import { Modal } from '@/components/ui';

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdCmi8SVddoUUufsWVYSR84yjggY4FoUGH6xoAmkY1L09JMKQ/viewform?embedded=true';

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Skicka feedback" size="xl">
      <div className="bg-ink-50 h-[75vh]">
        <iframe
          src={GOOGLE_FORM_URL}
          title="Feedback-formulär"
          className="w-full h-full border-0"
          loading="lazy"
        >
          Läser in…
        </iframe>
      </div>
    </Modal>
  );
}
