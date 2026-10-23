// Generated public contract. Update through its owner; do not edit by hand.
import { CATEGORY_CATALOG as TAXONOMY } from './catalog.generated';
import type { SearchSuggestionDto } from './discovery.generated';
const normalize = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
/** Deterministic and local: no personal names, work text, or per-keystroke requests. */
export function conditionSuggestions(
  input: string,
  currentYear = new Date().getFullYear(),
): SearchSuggestionDto[] {
  const text = normalize(input);
  if (!text || [...text].length > 100) return [];
  const terms = text.split(" ");
  const matches: {
    label: string;
    params: Record<string, string>;
    index: number;
    exact: boolean;
  }[] = [];
  function add(
    label: string,
    aliases: readonly string[],
    params: Record<string, string>,
  ) {
    const index = terms.findIndex((t) =>
      aliases.some((a) => normalize(a).includes(t)),
    );
    if (index < 0) return;
    matches.push({
      label,
      params,
      index,
      exact: aliases.some((a) => normalize(a) === terms[index]),
    });
  }
  for (const category of TAXONOMY) {
    add(`カテゴリ「${category.label}」`, [category.label], {
      category: category.id,
    });
    for (const sub of category.subcategories)
      add(`${category.label} ＞ ${sub.label}`, [sub.label], {
        category: category.id,
        subcategory: sub.id,
      });
  }
  for (let year = currentYear; year >= 2020; year--)
    add(
      `${year}年度入学`,
      [String(year), `${year}年度`, `${year}年度入学`, `${year}年入学`],
      { year: String(year) },
    );
  add("探究科", ["探究科"], { course: "tankyu" });
  add("普通科", ["普通科"], { course: "general" });
  matches.sort((a, b) => Number(b.exact) - Number(a.exact));
  const items = matches.map((match) => {
    const remainder = terms.filter((_, i) => i !== match.index).join(" ");
    const params = new URLSearchParams(match.params);
    if (remainder) params.set("q", remainder);
    return {
      label: `${match.label}${remainder ? `で「${remainder}」を検索` : "で探す"}`,
      parameters: params.toString(),
      source: "condition" as const,
    };
  });
  // Combine unambiguous dimensions, e.g. "2024 探究科 環境 プラスチック".
  const chosen = matches.filter(
    (m) =>
      !matches.some(
        (other) =>
          other !== m &&
          other.index === m.index &&
          !(m.exact && !other.exact) &&
          !(
            m.params.category &&
            !m.params.subcategory &&
            other.params.category === m.params.category
          ) &&
          JSON.stringify(other.params) !== JSON.stringify(m.params),
      ),
  );
  const used = new Set<number>(),
    merged: Record<string, string> = {},
    labels: string[] = [];
  for (const m of chosen) {
    if (
      used.has(m.index) ||
      Object.keys(m.params).some((k) => merged[k] && merged[k] !== m.params[k])
    )
      continue;
    Object.assign(merged, m.params);
    used.add(m.index);
    labels.push(m.label);
  }
  if (used.size > 1) {
    const remainder = terms.filter((_, i) => !used.has(i)).join(" ");
    const params = new URLSearchParams(merged);
    if (remainder) params.set("q", remainder);
    items.unshift({
      label: `${labels.join("・")}${remainder ? `で「${remainder}」を検索` : "で探す"}`,
      parameters: params.toString(),
      source: "condition",
    });
  }
  return items
    .filter(
      (item, i, all) =>
        all.findIndex((x) => x.parameters === item.parameters) === i,
    )
    .slice(0, 8);
}
