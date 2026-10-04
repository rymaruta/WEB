import { syndicationKey } from "@/lib/coverage";
import { publisherLabel } from "@/lib/publisher";

/**
 * まとめ記事の要点ごとの確認状況。要点に付いた出典番号（資料の番号）から機械的に分ける。
 * 真偽の判定ではなく、「何を根拠に書いたか」の種類を示す（AI に判断させない）。
 * - official: 官公庁・企業の発表（当事者の一次資料）が根拠に含まれる。当事者の発表なので「正しい」とは限らず、「発表が出典」と示す
 * - multi: 2媒体以上の報道が根拠（同じ見出しの転載・再配信は1つと数える）
 * - single: 1媒体の報道だけが根拠
 * 報道には、SNS 経由で集めた報道機関の記事（はてなブックマーク経由の NHK など）も含める（媒体名はドメインから読む）
 */
export type PointStatus = "official" | "multi" | "single";

export type CitedSource = { id: number; publisher: string; kind: string; title?: string };

/** 報道の記事（企業・官公庁の発表以外）を、媒体ごと・見出しごとに1つにまとめる。同じ見出しは転載・再配信として1つと数える */
function distinctReports(list: CitedSource[]): string[] {
  const seenTitle = new Set<string>();
  const publishers: string[] = [];
  for (const s of list) {
    if (s.kind === "PRESS") continue;
    const label = publisherLabel(s.publisher);
    if (publishers.includes(label)) continue;
    const key = s.title ? syndicationKey(s.title, s.publisher) : "";
    if (key && seenTitle.has(key)) continue;
    if (key) seenTitle.add(key);
    publishers.push(label);
  }
  return publishers;
}

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
  const reports = distinctReports(list);
  const publishers = [...new Set(list.map((s) => publisherLabel(s.publisher)))];
  if (list.some((s) => s.kind === "PRESS")) return { status: "official", publishers };
  if (reports.length >= 2) return { status: "multi", publishers: reports };
  return { status: "single", publishers: reports.length ? reports : publishers };
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
  return { news: new Set(list.filter((s) => s.kind !== "PRESS").map((s) => publisherLabel(s.publisher))).size, official: list.some((s) => s.kind === "PRESS") };
}
