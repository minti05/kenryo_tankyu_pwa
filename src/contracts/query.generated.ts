// Generated public contract. Update through its owner; do not edit by hand.
import { CATEGORY_CATALOG as TAXONOMY } from './catalog.generated';
const DOCUMENT_TYPES = ['slide', 'report', 'poster', 'thesis'] as const;
export function normalizeSearch(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}
export interface SearchQuery {
  q: string;
  category: string;
  subcategory: string;
  year: string;
  course: string;
  event: string;
  kind: string;
  award: string;
  awardName: string;
  sort: "relevance" | "newest" | "oldest" | "likes";
  limit: number;
  awardsOnly: boolean;
}
export function parseSearch(params: URLSearchParams): SearchQuery {
  const allowed = [
    "q",
    "category",
    "subcategory",
    "year",
    "course",
    "event",
    "kind",
    "award",
    "awardName",
    "sort",
    "limit",
    "cursor",
    "awardsOnly",
  ];
  for (const key of params.keys())
    if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new Error("invalid_search");
  const q = normalizeSearch(params.get("q") ?? ""),
    category = params.get("category") ?? "",
    subcategory = params.get("subcategory") ?? "",
    year = params.get("year") ?? "",
    course = params.get("course") ?? "",
    event = params.get("event") ?? "",
    kind = params.get("kind") ?? "",
    award = params.get("award") ?? "",
    awardName = normalizeSearch(params.get("awardName") ?? ""),
    sort = params.get("sort") ?? "likes",
    limit = Number(params.get("limit") ?? "20");
  const c = TAXONOMY.find((x) => x.id === category);
  if (params.has("awardsOnly") && params.get("awardsOnly") !== "1")
    throw new Error("invalid_search");
  if (
    [...q].length > 100 ||
    q.split(" ").filter(Boolean).length > 10 ||
    /[\u0000-\u001f\u007f]/u.test(q) ||
    (category && !c) ||
    (subcategory &&
      (!c || !c.subcategories.some((s) => s.id === subcategory))) ||
    (year && !/^20\d{2}$/.test(year)) ||
    (course && !["tankyu", "general"].includes(course)) ||
    (event && !["localLearning", "individualTankyu"].includes(event)) ||
    (kind && !(DOCUMENT_TYPES as readonly string[]).includes(kind)) ||
    (award && !["1", "2", "3", "4"].includes(award)) ||
    [...awardName].length > 100 ||
    !["relevance", "newest", "oldest", "likes"].includes(sort) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw new Error("invalid_search");
  return {
    q,
    category,
    subcategory,
    year,
    course,
    event,
    kind,
    award,
    awardName,
    sort: sort as SearchQuery["sort"],
    limit,
    awardsOnly: params.get("awardsOnly") === "1",
  };
}
export function searchParameters(q: SearchQuery): string {
  const p = new URLSearchParams();
  for (const k of [
    "q",
    "category",
    "subcategory",
    "year",
    "course",
    "event",
    "kind",
    "award",
    "awardName",
    "sort",
  ] as const)
    if (q[k]) p.set(k, q[k]);
  if (q.awardsOnly) p.set("awardsOnly", "1");
  return p.toString();
}
export function searchText(w: {
  title: string;
  author: string;
  category1: string;
  category2: string;
  subCategory1: string;
  subCategory2: string;
  summary?: string;
}): string {
  return normalizeSearch(w.title);
}
export function matchesSearch(
  w: import('./discovery.generated').SearchWorkDto,
  q: SearchQuery,
): boolean {
  const category =
    !q.category ||
    (w.category1 === q.category &&
      (!q.subcategory || w.subCategory1 === q.subcategory)) ||
    (w.category2 === q.category &&
      (!q.subcategory || w.subCategory2 === q.subcategory));
  const kinds = {
    slide: w.existsSlide,
    report: w.existsReport,
    poster: w.existsPoster,
    thesis: w.existsThesis,
  };
  return !!(
    (!q.awardsOnly || w.awardType !== undefined) &&
    category &&
    (!q.year || String(w.enterYear) === q.year) &&
    (!q.course || w.course === q.course) &&
    (!q.event || w.eventName === q.event) &&
    (!q.kind || kinds[q.kind as keyof typeof kinds]) &&
    (!q.award || String(w.awardType) === q.award) &&
    (!q.awardName ||
      normalizeSearch(w.awardName ?? "").includes(q.awardName)) &&
    q.q
      .split(" ")
      .filter(Boolean)
      .every((term) => searchText(w).includes(term))
  );
}
export function searchRank(title: string, q: SearchQuery): number {
  const n = normalizeSearch(title);
  return q.sort !== "relevance" || !q.q
    ? 0
    : n === q.q
      ? 0
      : n.startsWith(q.q)
        ? 1
        : 2;
}

/** Same ordering as title_candidates; used by bounded, fully loaded collections. */
export function sortSearchWorks<T extends import('./discovery.generated').SearchWorkDto>(works: readonly T[], q: SearchQuery): T[] {
  const priority = (w: T) => (w.awardType ? 0 : 2) + (w.course === 'tankyu' ? 0 : 1);
  return [...works].sort((a,b) => {
    const rank = q.sort === 'likes' ? (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0)
      : q.sort === 'oldest' ? a.enterYear - b.enterYear
      : searchRank(a.title,q) - searchRank(b.title,q);
    return rank || (q.sort === 'newest' ? 0 : priority(a)-priority(b)) || b.documentID.localeCompare(a.documentID);
  });
}
