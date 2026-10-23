import { ConditionSuggestions } from './ConditionSuggestions';
import { useLocation } from 'react-router-dom';
import { useEffect, useId, useRef, useState } from 'react';
import { SearchForm } from './SearchForm';
import { SearchHistory } from './SearchHistory';
export function DesktopSearch({
  className = 'desktop-search',
  autoFocus = false,
  onSubmitted,
  source,
}: {
  className?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  source?: string | undefined;
}) {
  const location = useLocation();
  const [text, setText] = useState(
    () =>
      new URLSearchParams(
        source ? new URL(source, window.location.origin).search : location.search,
      ).get('q') ?? '',
  );
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);
  return (
    <div
      className={className}
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          event.stopPropagation();
        }
      }}
    >
      <SearchForm
        label="ヘッダーで作品を検索"
        source={source}
        autoFocus={autoFocus}
        preventScrollOnFocus
        onActivate={() => setOpen(true)}
        onQueryChange={setText}
        onSubmitted={() => {
          setOpen(false);
          onSubmitted?.();
        }}
        expanded={open}
        controls={id}
      />
      {open && (
        <div className="search-dropdown" id={id}>
          <ConditionSuggestions text={text} source={source} onNavigate={() => setOpen(false)} />
          <SearchHistory compact onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
