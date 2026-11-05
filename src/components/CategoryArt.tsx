import './category-art.css';
import { useTheme } from '../lib/theme';
import type { CategoryId } from '../contracts/catalog.generated';
export function CategoryArt({
  category,
  className = '',
  secondaryCategory,
}: {
  category: CategoryId;
  className?: string | undefined;
  secondaryCategory?: CategoryId | 'none' | undefined;
}) {
  const { theme } = useTheme();
  const images: Record<string, string> = {
    mind_body: 'health',
    sports: 'sports',
    education: 'education',
    food_life: 'life',
    community: 'society',
    society: 'rights',
    economy: 'business',
    agriculture: 'industry',
    nature: 'science',
    environment: 'environment',
    technology: 'technology',
    humanities: 'history',
    arts: 'art',
    entertainment: 'entertainment',
  };
  const base = images[category] ?? category;
  const source =
    category === 'other'
      ? `other_for_${theme}`
      : base === 'rights' && theme === 'dark'
        ? 'rights_for_dark'
        : base === 'life' && theme === 'light'
          ? 'life_for_light'
          : base;
  if (secondaryCategory && secondaryCategory !== 'none' && secondaryCategory !== category)
    return (
      <span className={`category-art-pair ${className}`} aria-hidden="true">
        <CategoryArt category={category} className="category-art-first" />
        <CategoryArt category={secondaryCategory} className="category-art-second" />
      </span>
    );
  return (
    <picture className={className}>
      <img
        src={`/images/categories/${source}.svg`}
        alt=""
        width="400"
        height="400"
        loading="lazy"
      />
    </picture>
  );
}
