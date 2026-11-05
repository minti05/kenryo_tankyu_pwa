import '../features/works/work-actions.css';
import './Modal.css';
import { useEffect, useRef, type ReactNode } from 'react';
import { Trash2, X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  variant = 'default',
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: 'default' | 'confirm';
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!,
      previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`${variant === 'confirm' ? 'confirm-modal' : 'work-modal'} ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          onClose();
      }}
    >
      {variant === 'confirm' ? (
        <div className="confirm-modal-heading">
          <span className="confirm-modal-icon">
            <Trash2 size={24} strokeWidth={1.6} />
          </span>
          <h2>{title}</h2>
        </div>
      ) : (
        <div className="work-modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label={`${title}を閉じる`}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
      )}
      <div className={variant === 'confirm' ? 'confirm-modal-body' : 'work-modal-body'}>
        {children}
      </div>
    </dialog>
  );
}
