import type { CategoryId } from '../contracts/catalog.generated';
export function CategoryArt({
  category,
  className = '',
}: {
  category: CategoryId;
  className?: string | undefined;
}) {
  const source = category === 'other' ? 'other_for_light' : category;
  return (
    <picture className={className}>
      {category === 'other' && (
        <source
          media="(prefers-color-scheme: dark)"
          srcSet="/images/categories/other_for_dark.png"
        />
      )}
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
