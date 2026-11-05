import { LoadingIndicator } from './Loading';
import { useEffect, useRef, useState } from 'react';
export function UpdateDialog({ onUpdate }: { onUpdate: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    button.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="version-dialog"
      aria-labelledby="version-title"
      onCancel={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          button.current?.focus();
        }
      }}
    >
      <h2 id="version-title">新しいバージョンがあります</h2>
      {error && (
        <>
          <p role="alert">{error}</p>
          <p>
            <a href="/assets/recover.html">修復して開く</a>
          </p>
        </>
      )}
      <button
        ref={button}
        className="button primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await onUpdate();
          } catch {
            setError('更新できませんでした。通信を確認して、もう一度お試しください。');
            setBusy(false);
          }
        }}
      >
        {busy ? <LoadingIndicator inline label="更新中" /> : '更新する'}
      </button>
    </dialog>
  );
}
