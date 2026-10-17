import { CATEGORY_CATALOG } from '../../contracts/catalog.generated';
import type { WorkDto, DocumentType } from '../../contracts/work.generated';
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  slide: 'スライド',
  report: 'レポート',
  poster: 'ポスター',
  thesis: '論文',
};
export const categoryLabel = (id: string) =>
  CATEGORY_CATALOG.find((c) => c.id === id)?.label ?? 'その他';
export function documentTypes(work: WorkDto): DocumentType[] {
  return (['poster', 'report', 'thesis', 'slide'] as const).filter(
    (kind) =>
      ({
        poster: work.existsPoster,
        report: work.existsReport,
        thesis: work.existsThesis,
        slide: work.existsSlide,
      })[kind],
  );
}
const normalized = (text: string) =>
  text.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, ' ').trim();
export function filterWorks(works: WorkDto[], params: URLSearchParams) {
  const words = normalized(params.get('q') ?? '')
      .split(' ')
      .filter(Boolean),
    category = params.get('category'),
    year = params.get('year'),
    kind = params.get('kind');
  const filtered = works.filter(
    (w) =>
      (!category || w.category1 === category) &&
      (!year || String(w.enterYear) === year) &&
      (!kind || documentTypes(w).includes(kind as DocumentType)) &&
      words.every((word) =>
        normalized(
          [w.title, w.summary ?? '', categoryLabel(w.category1), w.author].join(' '),
        ).includes(word),
      ),
  );
  return filtered.sort(
    params.get('sort') === 'popular'
      ? (a, b) => b.likes - a.likes
      : (a, b) => b.enterYear - a.enterYear || b.documentID.localeCompare(a.documentID),
  );
}
