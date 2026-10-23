import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Share2, Download, Flag } from 'lucide-react';
export function WorkMenu({
  onShare,
  onDownload,
  onReport,
  expandedActions = false,
}: {
  onShare: () => void;
  onDownload: () => void;
  onReport: () => void;
  expandedActions?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  function choose(action: () => void) {
    trigger.current?.focus({ preventScroll: true });
    setOpen(false);
    action();
  }
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: Event) => {
      // Safari focuses the tabindex=-1 main ancestor on mouse-down of a button.
      // That ancestor focus must not remove the menu before its click is delivered.
      if (
        event.type === 'focusin' &&
        event.target instanceof Node &&
        event.target.contains(root.current)
      )
        return;
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);
  return (
    <>
      {expandedActions && (
        <>
          <button
            className="work-icon-button"
            aria-label="共有する…"
            title="共有する…"
            onClick={onShare}
          >
            <Share2 size={22} />
          </button>
          <button
            className="work-icon-button"
            aria-label="PDFダウンロード"
            title="PDFダウンロード"
            onClick={onDownload}
          >
            <Download size={22} />
          </button>
        </>
      )}
      <div
        className="work-menu"
        ref={root}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            const items = Array.from(
              root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [],
            );
            if (!open) {
              setOpen(true);
              return;
            }
            const i = items.findIndex((item) => item === document.activeElement);
            items[
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? items.length - 1
                  : (i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
            ]?.focus();
          }
        }}
      >
        <button
          ref={trigger}
          className="work-icon-button"
          aria-label="その他"
          title="その他"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <MoreHorizontal size={25} />
        </button>
        {open && (
          <div className="work-menu-list" role="menu" aria-label="作品の操作">
            {!expandedActions && (
              <>
                <button role="menuitem" onClick={() => choose(onShare)}>
                  <Share2 size={19} />
                  共有する…
                </button>
                <button role="menuitem" onClick={() => choose(onDownload)}>
                  <Download size={19} />
                  PDFダウンロード
                </button>
              </>
            )}
            <button role="menuitem" onClick={() => choose(onReport)}>
              <Flag size={19} />
              作品情報を報告
            </button>
          </div>
        )}
      </div>
    </>
  );
}
