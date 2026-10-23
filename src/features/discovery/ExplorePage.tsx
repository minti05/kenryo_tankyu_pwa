import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import { CategoryArt } from '../../components/CategoryArt';
import { useAuth } from '../auth/context';
import { recordSearch, cacheSearchHistory } from './search-history';
import './discovery.css';
export default function ExplorePage() {
  const { categoryId } = useParams(),
    [params] = useSearchParams();
  const { request, session } = useAuth(),
    query = useQueryClient();
  if (params.size) return <Navigate to={`/results?${params}`} replace />;
  const category = CATEGORY_CATALOG.find((c) => c.id === categoryId);
  if (categoryId && !category) return <Navigate to="/explore" replace />;
  function remember(subcategory = '') {
    const params = new URLSearchParams({ category: category!.id });
    if (subcategory) params.set('subcategory', subcategory);
    void recordSearch(request, params)
      .then((updated) => {
        cacheSearchHistory(query, session?.uid, updated);
      })
      .catch(() => {});
  }
  return (
    <div className="page-container explore-page">
      {category ? (
        <>
          <Link className="text-link" to="/explore">
            <ArrowLeft size={18} />
            カテゴリに戻る
          </Link>
          <header className="category-heading">
            <CategoryArt category={category.id} />
            <div>
              <h1>{category.label}</h1>
            </div>
          </header>
          <div className="subcategory-grid" aria-label="サブカテゴリ">
            <Link to={`/results?category=${category.id}`} onClick={() => remember()}>
              <span>すべて</span>
              <ArrowRight size={20} />
            </Link>
            {category.subcategories.map((s) => (
              <Link
                key={s.id}
                to={`/results?category=${category.id}&subcategory=${s.id}`}
                onClick={() => remember(s.id)}
              >
                <span>{s.label}</span>
                <ArrowRight size={20} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <h1 className="sr-only">探索</h1>
          <div className="genre-grid" aria-label="カテゴリ">
            {CATEGORY_CATALOG.map((c) => (
              <Link className="genre-card" data-category={c.id} key={c.id} to={`/explore/${c.id}`}>
                <span>{c.label}</span>
                <CategoryArt category={c.id} />
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
