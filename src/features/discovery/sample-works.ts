import type { WorkDto, DocumentType } from '../../contracts/work.generated';
type Seed = {
  id: string;
  title: string;
  category: WorkDto['category1'];
  sub: WorkDto['subCategory1'];
  kind: DocumentType;
  year: number;
  likes: number;
};
const seeds: Seed[] = [
  {
    id: '24000100',
    title: '雨の日の通学路を、もっと歩きやすく',
    category: 'society',
    sub: 'traffic',
    kind: 'poster',
    year: 2024,
    likes: 12,
  },
  {
    id: '24000200',
    title: '植物は光の色で育ち方が変わる？',
    category: 'science',
    sub: 'ecology',
    kind: 'report',
    year: 2024,
    likes: 8,
  },
  {
    id: '23000300',
    title: '「おいしい」は見た目で変わるのか',
    category: 'life',
    sub: 'food',
    kind: 'thesis',
    year: 2023,
    likes: 9,
  },
  {
    id: '24000400',
    title: '忘れ物を減らす仕組みを考える',
    category: 'technology',
    sub: 'app',
    kind: 'slide',
    year: 2024,
    likes: 5,
  },
  {
    id: '23000500',
    title: '学校のごみ箱から考える資源の循環',
    category: 'environment',
    sub: 'recycle',
    kind: 'report',
    year: 2023,
    likes: 17,
  },
  {
    id: '22000600',
    title: 'ことばから見つめる、まちの記憶',
    category: 'history',
    sub: 'words',
    kind: 'poster',
    year: 2022,
    likes: 4,
  },
  {
    id: '24000700',
    title: '教室の音環境と、集中しやすさの関係',
    category: 'education',
    sub: 'studies',
    kind: 'slide',
    year: 2024,
    likes: 13,
  },
  {
    id: '23000800',
    title: '色が案内表示の伝わり方を変える',
    category: 'art',
    sub: 'industryDesign',
    kind: 'poster',
    year: 2023,
    likes: 6,
  },
  {
    id: '22000900',
    title: '朝の過ごし方と、一日の気分',
    category: 'health',
    sub: 'sleep',
    kind: 'report',
    year: 2022,
    likes: 10,
  },
];
/** 画面検証専用。実作品・学生情報を含めない。通常productionからは除外する。 */
export const SAMPLE_WORKS: WorkDto[] = seeds.map((s, i) => ({
  documentID: s.id,
  title: s.title,
  author: `サンプル班${String(i + 1).padStart(2, '0')}`,
  enterYear: s.year,
  course: i % 3 === 0 ? 'general' : 'tankyu',
  eventName: 'individualTankyu',
  category1: s.category,
  subCategory1: s.sub,
  category2: 'none',
  subCategory2: 'none',
  existsSlide: s.kind === 'slide',
  existsReport: s.kind === 'report',
  existsPoster: s.kind === 'poster',
  existsThesis: s.kind === 'thesis',
  likes: s.likes,
  revision: `sample-work-${i + 1}`,
  contractVersion: '1',
  summary:
    'この作品は画面を試すための架空のサンプルです。実際の研究内容や成果を表すものではありません。気になるテーマを探し、作品の情報や資料の種類を確認する流れを体験できます。',
}));
