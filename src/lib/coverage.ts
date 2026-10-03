/**
 * 報道の比べ方。同じ出来事を、各社が「何分後に」「どんな数字で」報じたかを並べる。
 * 多くの媒体を同時に集めているこのサイトだから出せる情報（DB に依存しない部分）
 */

import { cleanTitle } from "@/lib/feed/text";
import { publisherLabel } from "@/lib/publisher";
import { normalizeForMatch } from "@/lib/topics/similarity";

export type CoverageArticle = { id: number; publisher: string; publishedAt: Date; title: string; kind: string };

/** 比べる対象。報道機関の記事だけ（企業の発表は当事者なので速さを比べない。SNS は報道ではない） */
const isNews = (a: CoverageArticle) => a.kind === "NEWS";

/**
 * ほかの媒体の記事を転載して配信する媒体。転載は元の報道より後になるため、速さは比べない。
 * 記事の媒体は媒体名（ライブドアニュース）で入るため、名前で持つ（ドメインは名前のない媒体の記事のため）
 */
export const AGGREGATORS = new Set(["ライブドアニュース", "news.livedoor.com"]);
const isOriginalNews = (a: CoverageArticle) => isNews(a) && !AGGREGATORS.has(a.publisher);

/** 転載を見分けるための見出しの形（媒体名の飾りと表記の揺れを除く）。同じ形なら、媒体が違っても同じ記事とみなす */
export const syndicationKey = (title: string, publisher: string) => normalizeForMatch(cleanTitle(title, [publisherLabel(publisher)])).replace(/\s+/g, "");
const titleKey = (a: CoverageArticle) => syndicationKey(a.title, a.publisher);

/**
 * 比べる対象の報道（古い順）。報道機関の記事から、転載を除く。
 * - 転載を配信する媒体の記事
 * - 先に出た記事と同じ見出しの記事（提携先の記事をそのまま載せたもの。マイナビニュースがサッカーキングの記事を載せるなど）
 */
export function originalReports(articles: CoverageArticle[]): CoverageArticle[] {
  const seen = new Set<string>();
  return [...articles]
    .filter(isOriginalNews)
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime() || a.id - b.id)
    .filter((a) => {
      const key = titleKey(a);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** 媒体ごとの最初の記事と、最初の報道からの経過（分） */
export function coverageTimes(articles: CoverageArticle[]): Map<number, { minutes: number; first: boolean }> {
  const seen = new Set<string>();
  const firsts = originalReports(articles).filter((a) => (seen.has(a.publisher) ? false : (seen.add(a.publisher), true)));
  const out = new Map<number, { minutes: number; first: boolean }>();
  if (firsts.length < 2) return out;
  const t0 = firsts[0].publishedAt.getTime();
  firsts.forEach((a, i) => out.set(a.id, { minutes: Math.round((a.publishedAt.getTime() - t0) / 60_000), first: i === 0 }));
  return out;
}

/** 経過の表示（+5分、+2時間、+1日） */
export function elapsedLabel(minutes: number): string {
  if (minutes < 60) return `+${minutes}分`;
  if (minutes < 24 * 60) return `+${Math.round(minutes / 60)}時間`;
  return `+${Math.round(minutes / 1440)}日`;
}

/** 比べる数字の単位（日付や年齢のように、記事ごとに違って当然のものは除く） */
const UNITS = ["万人", "人", "兆円", "億円", "万円", "円", "件", "%", "社", "台", "棟", "戸", "ha", "km", "mm"];
const NUMBER_RE = new RegExp(`([\\p{Script=Han}\\p{Script=Katakana}ー]{2})(\\d+(?:\\.\\d+)?)(${UNITS.join("|")})`, "gu");

export type NumberDiff = {
  /** 数字の前の言葉と単位（例: 死者◯人） */
  label: string;
  values: { value: string; publishers: string[] }[];
};

/**
 * 見出しの数字が媒体によって分かれているもの。
 * 同じ言葉＋同じ単位（例: 「死者3人」と「死者4人」）で、値が違うときだけを拾う（別のことを数えた数字を比べないように）
 */
export function numberDiffs(articles: CoverageArticle[], label: (publisher: string) => string = (p) => p): NumberDiff[] {
  const byKey = new Map<string, Map<string, Set<string>>>();
  const seenPublisher = new Set<string>();
  for (const a of articles.filter(isNews)) {
    if (seenPublisher.has(a.publisher)) continue;
    seenPublisher.add(a.publisher);
    const perKey = new Map<string, string>();
    for (const m of a.title.normalize("NFKC").replace(/(\d),(?=\d{3})/g, "$1").matchAll(NUMBER_RE)) {
      const key = `${m[1]}◯${m[3]}`;
      // 1つの見出しに同じ言葉・単位の数字が2つあるときは、比べない
      perKey.set(key, perKey.has(key) ? "" : m[2]);
    }
    for (const [key, value] of perKey) {
      if (!value) continue;
      const values = byKey.get(key) ?? new Map<string, Set<string>>();
      values.set(value, (values.get(value) ?? new Set()).add(label(a.publisher)));
      byKey.set(key, values);
    }
  }
  return [...byKey]
    .filter(([, values]) => values.size >= 2)
    .map(([key, values]) => ({
      label: key,
      values: [...values].map(([value, pubs]) => ({ value: key.replace("◯", value).slice(2), publishers: [...pubs] })),
    }));
}

/** 速報ランキング用：話題ごとに最初に報じた報道機関（転載を除いて、報じた媒体が minPublishers 以上の話題だけ） */
export function firstReporter(articles: CoverageArticle[], minPublishers = 3): string | null {
  const news = originalReports(articles);
  if (new Set(news.map((a) => a.publisher)).size < minPublishers) return null;
  return news[0]?.publisher ?? null;
}

/** 直近 days 日以内か */
export function withinDays(at: Date, days: number, now = new Date()): boolean {
  return now.getTime() - at.getTime() <= days * 86_400_000;
}
