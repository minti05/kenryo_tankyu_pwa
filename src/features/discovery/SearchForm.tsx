import { useState, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useAuth } from '../auth/context';
import './discovery.css';
import { hasSearchConditions } from './filter-options';
import { recordSearchInBackground } from './search-history';
import { clearResultsPosition } from './results-position';
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
  const [typed, setTyped] = useState<{ basis: string; value: string } | null>(null);
  const id = useId();
  const searchLocation = source ? new URL(source, window.location.origin) : location;
  const params = new URLSearchParams(searchLocation.search),
    q = params.get('q') || '';
  const current = typed?.basis === q ? typed.value : q;
  const conditions =
    source || ['/results', '/awards', '/search'].includes(location.pathname)
      ? new URLSearchParams(searchLocation.search)
      : new URLSearchParams();
  if (current.trim()) conditions.set('q', current.trim());
  else conditions.delete('q');
  const canSearch = hasSearchConditions(conditions, searchLocation.pathname === '/awards');
  return (
    <form
      className={`query-form ${className}`}
      role="search"
      onSubmit={(e) => {
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
        if (!hasSearchConditions(next, searchLocation.pathname === '/awards')) return;
        const awards = searchLocation.pathname === '/awards';
        clearResultsPosition(session?.uid, awards ? '/api/awards' : '/api/works', next);
        navigate(`${awards ? '/awards' : '/results'}?${next}`);
        recordSearchInBackground(query, session?.uid, request, next, awards);
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
        placeholder="キーワードで検索"
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
          setTyped({ basis: q, value: event.target.value });
          onActivate?.();
          onQueryChange?.(event.target.value);
        }}
        aria-expanded={expanded}
        aria-controls={controls}
      />
      <button type="submit" disabled={!canSearch} aria-label="検索する">
        <Search size={21} />
      </button>
    </form>
  );
}
