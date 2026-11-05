import { CategoryArt } from './CategoryArt';
import { useTheme } from '../lib/theme';
import { CATEGORY_CATALOG, type CategoryId } from '../contracts/catalog.generated';

// Only work lists/cards use these assets. Category navigation keeps CategoryArt.
const subcategoryArt: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  CATEGORY_CATALOG.map((category) => [category.id, category.subcategories.map((sub) => sub.id)]),
);

function source(category: CategoryId, subcategory: string | undefined, theme: string) {
  const variant =
    (category === 'society' && theme === 'dark') || (category === 'food_life' && theme === 'light')
      ? `${theme}/`
      : '';
  return subcategory && subcategoryArt[category]?.includes(subcategory)
    ? `/images/subcategories/${variant}${subcategory}.svg`
    : undefined;
}

export function WorkArt({
  category,
  subcategory,
  secondaryCategory,
  secondarySubcategory,
  className = '',
}: {
  category: CategoryId;
  subcategory?: string | undefined;
  secondaryCategory?: CategoryId | 'none' | undefined;
  secondarySubcategory?: string | undefined;
  className?: string | undefined;
}) {
  const { theme } = useTheme();
  const primary = source(category, subcategory, theme);
  const secondary =
    secondaryCategory && secondaryCategory !== 'none'
      ? source(secondaryCategory, secondarySubcategory, theme)
      : undefined;
  if (
    secondaryCategory &&
    secondaryCategory !== 'none' &&
    (secondaryCategory !== category || primary !== secondary)
  ) {
    return (
      <span className={`category-art-pair ${className}`} aria-hidden="true">
        <WorkArt category={category} subcategory={subcategory} className="category-art-first" />
        <WorkArt
          category={secondaryCategory}
          subcategory={secondarySubcategory}
          className="category-art-second"
        />
      </span>
    );
  }
  return primary ? (
    <picture className={className}>
      <img src={primary} alt="" width="400" height="400" loading="lazy" />
    </picture>
  ) : (
    <CategoryArt category={category} className={className} />
  );
}
