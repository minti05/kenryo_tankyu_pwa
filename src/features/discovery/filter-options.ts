import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
export const SORT_OPTIONS = [
  ['relevance', '一致するタイトルから'],
  ['newest', '新しい順'],
  ['oldest', '古い順'],
  ['likes', 'いいね順'],
] as const;
export const COURSES = [
  ['tankyu', '探究科'],
  ['general', '普通科'],
];
export const EVENTS = [['individualTankyu', '個人探究']];
export const KINDS = [
  ['poster', 'ポスター'],
  ['report', 'レポート'],
  ['thesis', '論文'],
  ['slide', 'スライド'],
];
export const AWARDS = [
  ['1', '大賞'],
  ['2', '優秀賞'],
  ['3', '奨励賞'],
  ['4', '入賞'],
];
const FILTER_KEYS = [
  'q',
  'category',
  'subcategory',
  'year',
  'course',
  'event',
  'kind',
  'award',
  'awardName',
];
export function conditionLabels(params: URLSearchParams) {
  const category = CATEGORY_CATALOG.find((c) => c.id === params.get('category'));
  const labels: Record<string, string | undefined> = {
    q: params.get('q') ? `「${params.get('q')}」` : undefined,
    category: category?.label,
    subcategory: category?.subcategories.find((s) => s.id === params.get('subcategory'))?.label,
    year: params.get('year') ? `${params.get('year')}年度入学` : undefined,
    course: COURSES.find(([id]) => id === params.get('course'))?.[1],
    event: EVENTS.find(([id]) => id === params.get('event'))?.[1],
    kind: KINDS.find(([id]) => id === params.get('kind'))?.[1],
    award: AWARDS.find(([id]) => id === params.get('award'))?.[1],
    awardName: params.get('awardName') || undefined,
  };
  return FILTER_KEYS.filter((key) => params.has(key)).map((key) => ({
    key,
    label: labels[key] || params.get(key)!,
  }));
}
