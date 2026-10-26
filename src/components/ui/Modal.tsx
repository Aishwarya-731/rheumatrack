import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Prevent closing via Escape / backdrop (e.g. while an operation is running). */
  locked?: boolean;
  describedBy?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible dialog: focus moves in, Tab is trapped, Escape closes, focus is restored on close. */
export function Modal({ open, title, onClose, children, footer, wide, locked, describedBy }: ModalProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const firstEl = items[0] as HTMLElement;
        const lastEl = items[items.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
