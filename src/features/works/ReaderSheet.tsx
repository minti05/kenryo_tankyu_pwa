import { useId, useRef, useState, useEffect, type ReactNode, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './ReaderSheet.module.css';
import { sheetBounds } from './reader-sheet-bounds';
export type SheetTab = 'summary' | 'information' | 'related';
export function ReaderSheet({
  height,
  onHeight,
  onClose,
  summary,
  information,
  related,
}: {
  height: number;
  onHeight: (n: number) => void;
  onClose: () => void;
  summary: ReactNode;
  information: ReactNode;
  related: ReactNode;
}) {
  const [tab, setTab] = useState<SheetTab>('summary'),
    id = useId(),
    drag = useRef<{ y: number; height: number } | null>(null);
  useEffect(() => {
    const previous = document.activeElement;
    document.getElementById(`${id}-summary`)?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [id]);
  const change = (n: number) =>
    onHeight(Math.max(sheetBounds().min, Math.min(sheetBounds().max, n)));
  const start = (e: PointerEvent) => {
    drag.current = { y: e.clientY, height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  return createPortal(
    <section
      className={styles.sheet}
      style={{ height }}
      aria-label="作品の補足"
      data-reader-sheet
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className={styles.grip}
        role="separator"
        aria-label="シートの高さ"
        aria-orientation="horizontal"
        aria-valuemin={sheetBounds().min}
        aria-valuemax={sheetBounds().max}
        aria-valuenow={Math.round(height)}
        tabIndex={0}
        onPointerDown={start}
        onPointerMove={(e) => {
          if (drag.current) change(drag.current.height + drag.current.y - e.clientY);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            change(
              e.key === 'Home'
                ? sheetBounds().min
                : e.key === 'End'
                  ? window.innerHeight
                  : height + (e.key === 'ArrowUp' ? 40 : -40),
            );
          }
        }}
      >
        <span />
      </div>
      <div className={styles.menu}>
        <div role="tablist" aria-label="作品の補足メニュー">
          {(
            [
              ['summary', 'AI要約'],
              ['information', '情報'],
              ['related', '関連'],
            ] as const
          ).map(([key, label], index) => (
            <button
              key={key}
              id={`${id}-${key}`}
              role="tab"
              aria-selected={tab === key}
              aria-controls={`${id}-panel`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const tabs = ['summary', 'information', 'related'] as const;
                  const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : 2)) % 3]!;
                  setTab(next);
                  document.getElementById(`${id}-${next}`)?.focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="icon-button" aria-label="シートを閉じる" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div
        className={styles.content}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${tab}`}
      >
        {tab === 'summary' ? summary : tab === 'information' ? information : related}
      </div>
    </section>,
    document.body,
  );
}
