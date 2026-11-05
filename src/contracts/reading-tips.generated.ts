// Generated public contract. Update through its owner; do not edit by hand.
/** Public, non-personal content cached on the device between app launches. */
export interface ReadingTipsDto {
  version: "1";
  revision: number;
  tips: string[];
}

export const DEFAULT_READING_TIPS: string[] = [
  "気になった言葉を一つ選び、「なぜ？」を考えてみよう。",
  "先輩の結論だけでなく、問いの立て方にも注目してみよう。",
  "自分の予想と違う結果に、新しい問いのヒントがある。",
  "グラフを見るときは、単位・対象・調べた人数を確かめよう。",
  "「分かったこと」と「まだ分からないこと」を分けてメモしよう。",
  "身近な困りごとを、調べられる小さな問いにしてみよう。",
  "似たテーマの作品を比べると、方法や視点の違いが見えてくる。",
  "情報を使うときは、出典と発表された時期を記録しておこう。",
  "インタビューでは、答えを誘導しない聞き方を考えてみよう。",
  "この探究を自分が続けるなら、次に何を調べたい？",
];

export function validReadingTips(value: unknown): value is ReadingTipsDto {
  if (!value || typeof value !== "object") return false;
  const data = value as ReadingTipsDto;
  return (
    data.version === "1" &&
    Number.isSafeInteger(data.revision) &&
    data.revision >= 1 &&
    Array.isArray(data.tips) &&
    data.tips.length <= 50 &&
    data.tips.every(
      (tip) =>
        typeof tip === "string" &&
        tip.trim() === tip &&
        tip.length > 0 &&
        tip.length <= 160 &&
        !/[\u0000-\u001f\u007f]/u.test(tip),
    ) &&
    new Set(data.tips).size === data.tips.length
  );
}
