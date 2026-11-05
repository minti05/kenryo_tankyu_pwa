import { useEffect, useRef, type ReactNode } from 'react';
import styles from './LibraryPage.module.css';

export function LibraryEntry({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const touch = useRef(false);
  const suppressClick = useRef(false);
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }
  useEffect(() => {
    window.addEventListener('scroll', cancel, true);
    return () => {
      cancel();
      window.removeEventListener('scroll', cancel, true);
    };
  }, []);
  return (
    <div
      className={styles.entry}
      onPointerDown={(event) => {
        cancel();
        suppressClick.current = false;
        touch.current = event.pointerType === 'touch';
        if (
          !touch.current ||
          !event.isPrimary ||
          (event.target as Element).closest('button, input, select, textarea')
        )
          return;
        origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        timer.current = setTimeout(() => {
          timer.current = null;
          suppressClick.current = true;
          onRemove();
        }, 450);
      }}
      onPointerMove={(event) => {
        const start = origin.current;
        if (
          start &&
          (event.pointerId !== start.id ||
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10)
        )
          cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenu={(event) => {
        if (touch.current && !(event.target as Element).closest('button')) event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
