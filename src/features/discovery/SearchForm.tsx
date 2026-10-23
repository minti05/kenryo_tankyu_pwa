import { useState, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useAuth } from '../auth/context';
import './discovery.css';
import { recordSearch, historyMessage, cacheSearchHistory } from './search-history';
export function SearchForm({
  autoFocus = false,
  className = '',
  label = '作品をキーワードで検索',
  preventScrollOnFocus = false,
  onActivate,
  onQueryChange,
  onSubmitted,
  expanded,
  controls,
  source,
}: {
  autoFocus?: boolean;
  className?: string;
  label?: string;
  preventScrollOnFocus?: boolean;
  onActivate?: () => void;
  onQueryChange?: (text: string) => void;
  onSubmitted?: () => void;
  expanded?: boolean;
  controls?: string;
  source?: string | undefined;
}) {
  const { request, session } = useAuth(),
    location = useLocation(),
    navigate = useNavigate(),
    query = useQueryClient();
  const [busy, setBusy] = useState(false),
    id = useId();
  const searchLocation = source ? new URL(source, window.location.origin) : location;
  const params = new URLSearchParams(searchLocation.search),
    q = params.get('q') || '';
  return (
    <form
      className={`query-form ${className}`}
      role="search"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get('q') || '').trim();
        const next =
          source || ['/results', '/awards', '/search'].includes(location.pathname)
            ? new URLSearchParams(searchLocation.search)
            : new URLSearchParams();
        next.delete('cursor');
        next.delete('awardsOnly');
        if (value) next.set('q', value);
        else next.delete('q');
        let error = '';
        setBusy(true);
        try {
          const updated = await recordSearch(request, next, searchLocation.pathname === '/awards');
          cacheSearchHistory(query, session?.uid, updated);
        } catch (e) {
          error = historyMessage(e);
        } finally {
          setBusy(false);
        }
        navigate(`${searchLocation.pathname === '/awards' ? '/awards' : '/results'}?${next}`, {
          state: { historyError: error },
        });
        onSubmitted?.();
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        key={q}
        id={id}
        type="search"
        name="q"
        defaultValue={q}
        placeholder="検索"
        maxLength={100}
        autoComplete="off"
        autoFocus={autoFocus}
        onPointerDown={
          preventScrollOnFocus
            ? (e) => {
                if (document.activeElement !== e.currentTarget) {
                  e.preventDefault();
                  e.currentTarget.focus({ preventScroll: true });
                }
              }
            : undefined
        }
        onFocus={(event) => {
          onQueryChange?.(event.target.value);
          onActivate?.();
        }}
        onChange={(event) => {
          onActivate?.();
          onQueryChange?.(event.target.value);
        }}
        aria-expanded={expanded}
        aria-controls={controls}
      />
      <button type="submit" disabled={busy} aria-label="検索する">
        <Search size={21} />
      </button>
    </form>
  );
}
