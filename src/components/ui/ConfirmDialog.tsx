import { useId, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** Confirmation for destructive or irreversible actions. Shows progress and errors inline. */
export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'The action failed. Please try again.');
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      locked={busy}
      describedBy={descId}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={busy} data-autofocus>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => void confirm()} disabled={busy}>
            {busy && <span className="spinner" aria-hidden />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div id={descId} className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {body}
      </div>
      {error && (
        <p role="alert" className="field-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
