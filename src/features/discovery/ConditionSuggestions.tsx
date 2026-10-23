import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { conditionSuggestions } from '../../contracts/condition-suggestions.generated';
import { useAuth } from '../auth/context';
import { recordSearch, cacheSearchHistory } from './search-history';
export function ConditionSuggestions({
  text,
  source,
  onNavigate,
}: {
  text: string;
  source?: string | undefined;
  onNavigate?: () => void;
}) {
  const location = useLocation(),
    navigate = useNavigate(),
    query = useQueryClient();
  const { request, session } = useAuth();
  const items = conditionSuggestions(text);
  if (!items.length) return null;
  const origin = source ? new URL(source, window.location.origin) : location;
  const target = origin.pathname === '/awards' ? '/awards' : '/results';
  function parameters(suggestion: string) {
    const next =
      source || ['/search', '/results', '/awards'].includes(origin.pathname)
        ? new URLSearchParams(origin.search)
        : new URLSearchParams();
    next.delete('q');
    next.delete('cursor');
    next.delete('awardsOnly');
    const condition = new URLSearchParams(suggestion);
    if (condition.has('category')) next.delete('subcategory');
    for (const [key, value] of condition) next.set(key, value);
    return next;
  }
  return (
    <section className="condition-suggestions" aria-label="条件から探す候補">
      <h2>この条件で探す</h2>
      <ul className="history-list">
        {items.map((item) => {
          const next = parameters(item.parameters);
          return (
            <li key={item.parameters}>
              <Link
                to={`${target}?${next}`}
                onClick={async (event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onNavigate?.();
                  navigate(`${target}?${next}`);
                  try {
                    const updated = await recordSearch(request, next, target === '/awards');
                    cacheSearchHistory(query, session?.uid, updated);
                  } catch {
                    /* A history failure must not interrupt or redirect an ongoing search. */
                  }
                }}
              >
                <SlidersHorizontal size={18} />
                <span>{item.label}</span>
                <ArrowUpRight size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
