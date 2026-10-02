import { getAnimeSchedule } from "@/lib/anime";
import { ANIME_KIND_LABELS } from "@/lib/anime-kinds";
import { CHANGE_KIND_LABELS } from "@/lib/change-kinds";
import { getChanges } from "@/lib/changes";
import { getGameReleasesInMonth } from "@/lib/queries";

/**
 * 特集ページ。ニュースから読み取った日付つきの情報（暮らしの変更・ゲームの発売・アニメの放送開始）を、
 * 月ごとに1ページの一覧にする。1か所にまとまった一覧は他のサイトに少ないため、このサイトを見る理由になる。
 * 文章は件数と見出しから組み立て、記事に書かれていないことは書かない
 */

export const FEATURE_KINDS = ["changes", "games", "anime"] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export type FeatureItem = {
  date: string;
  title: string;
  /** 種類（値上げ・放送など）。ゲームは機種 */
  label: string | null;
  /** 補足（放送局など） */
  note: string | null;
  topicId: number | null;
  /** 話題がなく、外部のページ（公式ストアなど）へつなぐ場合 */
  url: string | null;
};

export type Feature = {
  kind: FeatureKind;
  month: string;
  title: string;
  /** 検索結果や共有用の説明 */
  description: string;
  /** ページの冒頭の文 */
  lead: string;
  items: FeatureItem[];
  genreSlug: string;
  sourceNote: string | null;
};

export const isFeatureKind = (k: string): k is FeatureKind => (FEATURE_KINDS as readonly string[]).includes(k);

/** 公開する月の範囲。作り始めた月から、来月まで */
const FIRST_MONTH = "2026-09";

export function jstMonth(now = new Date(), offset = 0): string {
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
}

export function isFeatureMonth(month: string, now = new Date()): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= FIRST_MONTH && month <= jstMonth(now, 1);
}

export const featurePath = (kind: FeatureKind, month: string) => `/feature/${kind}/${month}`;

const monthLabel = (month: string) => `${Number(month.slice(0, 4))}年${Number(month.slice(5, 7))}月`;

/** 件数の内訳（多い順）。例: 「値上げ 12件、制度・法律改正 5件」 */
export function breakdown(items: { label: string | null }[], max = 4): string {
  const counts = new Map<string, number>();
  for (const it of items) if (it.label) counts.set(it.label, (counts.get(it.label) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([l, n]) => `${l} ${n}件`)
    .join("、");
}

export async function getFeature(kind: FeatureKind, month: string): Promise<Feature> {
  const m = monthLabel(month);
  if (kind === "changes") {
    const items: FeatureItem[] = (await getChanges([month])).map((c) => ({
      date: c.date,
      title: c.title,
      label: CHANGE_KIND_LABELS[c.kind] ?? null,
      note: null,
      topicId: c.topicId,
      url: null,
    }));
    const parts = breakdown(items);
    return {
      kind,
      month,
      genreSlug: "domestic",
      title: `${m}から変わること｜値上げ・値下げ・制度の変更まとめ`,
      description: `${m}に始まる値上げ・値下げ・制度の変更を、ニュースで報じられた内容から日付順にまとめた一覧です。`,
      lead: items.length
        ? `${m}に始まる値上げ・値下げ・制度の変更を、ニュースで報じられた日付順にまとめました。全${items.length}件${parts ? `（${parts}）` : ""}。各項目から、元の報道とまとめ記事を読めます。`
        : `${m}に始まる変更は、まだ報じられていません。報道があり次第、この一覧に加わります。`,
      items,
      sourceNote: null,
    };
  }
  if (kind === "games") {
    const items: FeatureItem[] = (await getGameReleasesInMonth(month)).map((g) => ({
      date: g.release,
      title: g.title,
      label: g.platforms.length ? g.platforms.join("・") : null,
      note: null,
      topicId: g.topicId,
      url: g.topicId ? null : g.storeUrl,
    }));
    const platforms = new Map<string, number>();
    for (const g of items) for (const p of g.label?.split("・") ?? []) platforms.set(p, (platforms.get(p) ?? 0) + 1);
    const top = [...platforms].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, n]) => `${p} ${n}本`).join("、");
    return {
      kind,
      month,
      genreSlug: "game",
      title: `${m}発売のゲーム一覧｜Switch 2・PS5・PC の発売日スケジュール`,
      description: `${m}に発売されるゲームを、ニュースの報道と任天堂・PlayStation・Steam の公式ストアの発売予定から日付順にまとめた一覧です。`,
      lead: items.length
        ? `${m}に発売されるゲームを、ニュースで報じられた発売日と、任天堂・PlayStation・Steam の公式ストアの発売予定から日付順にまとめました。全${items.length}本${top ? `（${top}）` : ""}。`
        : `${m}に発売されるゲームは、まだ見つかっていません。`,
      items,
      sourceNote: "公式ストアの作品（↗）は、各ストアの作品ページへ移ります。",
    };
  }
  const items: FeatureItem[] = (await getAnimeSchedule([month])).map((a) => ({
    date: a.date,
    title: a.title,
    label: ANIME_KIND_LABELS[a.kind] ?? null,
    note: a.channel,
    topicId: a.topicId,
    url: null,
  }));
  const parts = breakdown(items);
  return {
    kind,
    month,
    genreSlug: "anime",
    title: `${m}から始まるアニメ一覧｜放送・配信・劇場公開スケジュール`,
    description: `${m}に始まるテレビアニメの放送・配信と、アニメ映画の公開を日付順にまとめた一覧です。`,
    lead: items.length
      ? `${m}に始まるアニメのテレビ放送・配信・劇場公開を、日付順にまとめました。全${items.length}作品${parts ? `（${parts}）` : ""}。関連するニュースがある作品は、そのまとめに移れます。`
      : `${m}に始まるアニメは、まだ見つかっていません。`,
    items,
    sourceNote: "テレビアニメの放送開始予定は Wikipedia「日本のテレビアニメ作品一覧」（CC BY-SA）をもとにしています。",
  };
}

/** 特集の短い名前（入口のリンクに使う） */
export function featureShortName(kind: FeatureKind, month: string): string {
  const mm = `${Number(month.slice(5, 7))}月`;
  return kind === "changes" ? `${mm}から変わること` : kind === "games" ? `${mm}発売のゲーム` : `${mm}からのアニメ`;
}
