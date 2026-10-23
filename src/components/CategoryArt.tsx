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
  const source = category === 'other' ? `other_for_${theme}` : category;
  if (secondaryCategory && secondaryCategory !== 'none')
    return (
      <span className={`category-art-pair ${className}`} aria-hidden="true">
        <CategoryArt category={category} className="category-art-first" />
        <CategoryArt category={secondaryCategory} className="category-art-second" />
      </span>
    );
  return (
    <picture className={className}>
      <img
        src={`/images/categories/${source}.png`}
        alt=""
        width="400"
        height="400"
        loading="lazy"
      />
    </picture>
  );
}
