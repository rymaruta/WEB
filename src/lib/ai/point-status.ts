import { AGGREGATORS } from "@/lib/coverage";

/**
 * まとめ記事の要点ごとの確認状況。要点に付いた出典番号（資料の番号）から機械的に分ける。
 * 真偽の判定ではなく、「何を根拠に書いたか」の種類を示す（AI に判断させない）。
 * - official: 官公庁・企業の発表（当事者の一次資料）が根拠に含まれる。当事者の発表なので「正しい」とは限らず、「発表が出典」と示す
 * - multi: 独立した報道機関の2媒体以上が根拠
 * - single: 1媒体の報道だけが根拠
 */
export type PointStatus = "official" | "multi" | "single";

export type CitedSource = { id: number; publisher: string; kind: string };

export const POINT_STATUS_LABEL: Record<PointStatus, string> = {
  official: "公式発表が出典",
  multi: "複数の媒体が報道",
  single: "1媒体のみの報道",
};

/** 出典番号（1始まり）→ 資料。番号に当たる資料がなければ数えない */
function cited(numbers: number[], sourceIds: number[], sources: CitedSource[]): CitedSource[] {
  return numbers.flatMap((n) => {
    const s = sources.find((x) => x.id === sourceIds[n - 1]);
    return s ? [s] : [];
  });
}

/** 要点の確認状況。根拠の資料が1つもなければ null（表示しない） */
export function pointStatus(numbers: number[], sourceIds: number[], sources: CitedSource[]): { status: PointStatus; publishers: string[] } | null {
  const list = cited(numbers, sourceIds, sources);
  if (list.length === 0) return null;
  // 転載を配信する媒体は、元の報道と同じ内容なので独立した報道に数えない
  const news = [...new Set(list.filter((s) => s.kind === "NEWS" && !AGGREGATORS.has(s.publisher)).map((s) => s.publisher))];
  const publishers = [...new Set(list.map((s) => s.publisher))];
  if (list.some((s) => s.kind === "PRESS")) return { status: "official", publishers };
  if (news.length >= 2) return { status: "multi", publishers };
  return { status: "single", publishers };
}

/**
 * 報道くらべ: 要点を「共通して報じられていること」（公式発表または2媒体以上）と、
 * 「一部の媒体だけが報じていること」（1媒体だけ。媒体ごと）に分ける
 */
export function splitPoints(points: { text: string; sources: number[] }[], sourceIds: number[], sources: CitedSource[]) {
  const common: { text: string; status: PointStatus; publishers: string[] }[] = [];
  const only = new Map<string, string[]>();
  for (const p of points) {
    const s = pointStatus(p.sources, sourceIds, sources);
    if (!s) continue;
    if (s.status === "single") {
      const publisher = s.publishers[0];
      only.set(publisher, [...(only.get(publisher) ?? []), p.text]);
    } else {
      common.push({ text: p.text, ...s });
    }
  }
  return { common, only: [...only].map(([publisher, texts]) => ({ publisher, texts })) };
}

/** まとめ記事の材料にした独立した報道の媒体数と、公式発表を含むか（「N媒体の報道をもとに作成」の表示用） */
export function citedCounts(sourceIds: number[], sources: CitedSource[]) {
  const list = sourceIds.flatMap((id) => sources.filter((s) => s.id === id));
  return {
    news: new Set(list.filter((s) => s.kind !== "PRESS" && s.kind !== "SOCIAL").map((s) => s.publisher)).size,
    official: list.some((s) => s.kind === "PRESS"),
  };
}
