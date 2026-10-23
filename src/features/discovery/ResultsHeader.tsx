import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { DesktopSearch } from './DesktopSearch';
export function ResultsHeader({ source }: { source?: string }) {
  const [currentParams] = useSearchParams(),
    location = useLocation();
  const params = source ? new URLSearchParams(source.split('?')[1]) : currentParams;
  const [editing, setEditing] = useState(false);
  const category = CATEGORY_CATALOG.find((c) => c.id === params.get('category'));
  if (params.get('q') || editing)
    return (
      <>
        <DesktopSearch
          className="result-header-search"
          source={source}
          autoFocus={editing}
          onSubmitted={() => setEditing(false)}
        />
        {!params.get('q') && (
          <button
            className="icon-button"
            aria-label="キーワード入力を閉じる"
            onClick={() => setEditing(false)}
          >
            <X size={21} />
          </button>
        )}
      </>
    );
  return (
    <>
      <div className="result-category-title">
        {category && <CategoryArt category={category.id} />}
        <strong>
          {category?.label ||
            ((source?.split('?')[0] ?? location.pathname) === '/awards'
              ? 'KRGP受賞作品'
              : 'すべての作品')}
        </strong>
      </div>
      <button
        className="icon-button"
        aria-label="この条件にキーワードを追加"
        onClick={() => setEditing(true)}
      >
        <Search size={23} />
      </button>
    </>
  );
}
