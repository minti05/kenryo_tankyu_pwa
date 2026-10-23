import type { AwardOverviewDto, SearchWorkDto } from '../../contracts/discovery.generated';
import { matchesSearch, parseSearch, sortSearchWorks } from '../../contracts/query.generated';
export const awardsQueryKey = (uid: string | undefined) => ['krgp', uid] as const;
export const AWARDS_FRESH_MS = 30 * 60 * 1000;
export function awardsView(all: readonly SearchWorkDto[], params: URLSearchParams) {
  const query = parseSearch(params);
  query.awardsOnly = true;
  const editions = new Map<number, number>();
  const prizes = new Map<number, number>();
  const names = new Map<string, number>();
  for (const work of all) {
    if (!work.awardType) continue;
    editions.set(work.enterYear, (editions.get(work.enterYear) ?? 0) + 1);
    if (query.year && String(work.enterYear) !== query.year) continue;
    prizes.set(work.awardType, (prizes.get(work.awardType) ?? 0) + 1);
    if (work.awardName) names.set(work.awardName, (names.get(work.awardName) ?? 0) + 1);
  }
  const overview: AwardOverviewDto = {
    editions: [...editions]
      .sort(([a], [b]) => b - a)
      .map(([enterYear, count]) => ({ enterYear, count })),
    prizes: [...prizes]
      .sort(([a], [b]) => a - b)
      .map(([awardType, count]) => ({ awardType, count })),
    names: [...names]
      .sort(([a], [b]) => a.localeCompare(b, 'ja'))
      .map(([name, count]) => ({ name, count })),
  };
  return {
    items: sortSearchWorks(
      all.filter((work) => matchesSearch(work, query)),
      query,
    ),
    overview,
  };
}
