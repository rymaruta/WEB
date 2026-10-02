/**
 * 国別・チーム別のページ。見出しに国名・チーム名（とよく使われる言い換え）が入った話題を集める。
 * AI は使わず、決まった言葉の一覧で見分ける。言葉は JavaScript と PostgreSQL の両方の正規表現で同じように動く形だけを使う
 * （文字の並びの「|」区切り。先読みなどは使わない）。
 */

export type TagKind = "country" | "team";

export type Tag = {
  kind: TagKind;
  slug: string;
  name: string;
  /** 見出しに含まれていれば、その国・チームの話題とみなす言葉 */
  pattern: string;
  /** 含まれていれば除く言葉（「中国地方」など、別の意味で使われるもの） */
  exclude?: string;
};

const country = (slug: string, name: string, pattern: string, exclude?: string): Tag => ({ kind: "country", slug, name, pattern, exclude });
const team = (slug: string, name: string, pattern: string, exclude?: string): Tag => ({ kind: "team", slug, name, pattern, exclude });

export const COUNTRIES: Tag[] = [
  country(
    "us",
    "アメリカ",
    "アメリカ|米国|米大統領|米政府|米軍|米議会|米国務|米財務|米連邦|米中|米朝|米ロ|米露|米韓|米欧|米英|日米|米紙|米当局|米司法|米上院|米下院|ホワイトハウス|トランプ大統領|トランプ政権|トランプ氏",
  ),
  country("china", "中国", "中国|習近平|北京", "中国地方|中国電力|中国新聞|中国自動車道|中国・四国|中四国|中国銀行|中国放送"),
  country("korea", "韓国", "韓国|日韓|米韓|中韓|ソウル市|李在明"),
  country("north-korea", "北朝鮮", "北朝鮮|金正恩|朝鮮中央"),
  country("russia", "ロシア", "ロシア|プーチン|露政府|露軍|日露|クレムリン|モスクワ"),
  country("ukraine", "ウクライナ", "ウクライナ|ゼレンスキー|キーウ"),
  country("israel", "イスラエル", "イスラエル|ネタニヤフ"),
  country("palestine", "パレスチナ・ガザ", "パレスチナ|ガザ|ハマス|ヨルダン川西岸"),
  country("iran", "イラン", "イラン"),
  country("taiwan", "台湾", "台湾|頼清徳|台北"),
  country("india", "インド", "インド|モディ首相", "インドネシア|インドア"),
  country("uk", "イギリス", "英国|イギリス|英首相|英政府|英王室|チャールズ国王|ロンドン"),
  country("france", "フランス", "フランス|仏大統領|仏政府|マクロン|パリ市"),
  country("germany", "ドイツ", "ドイツ|独首相|独政府|ベルリン"),
  country("europe", "欧州・EU", "欧州|EU|ＥＵ"),
];

export const TEAMS: Tag[] = [
  team("giants", "巨人", "巨人|ジャイアンツ"),
  team("tigers", "阪神", "阪神|タイガース"),
  team("baystars", "DeNA", "DeNA|ＤｅＮＡ|ベイスターズ"),
  team("carp", "広島", "広島|カープ", "サンフレッチェ"),
  team("dragons", "中日", "中日|ドラゴンズ"),
  team("swallows", "ヤクルト", "ヤクルト|スワローズ"),
  team("hawks", "ソフトバンク", "ソフトバンク|ホークス"),
  team("fighters", "日本ハム", "日本ハム|日ハム|ファイターズ"),
  team("marines", "ロッテ", "ロッテ|マリーンズ"),
  team("eagles", "楽天", "楽天|イーグルス"),
  team("buffaloes", "オリックス", "オリックス|バファローズ"),
  team("lions", "西武", "西武|ライオンズ"),
  team("dodgers", "ドジャース", "ドジャース"),
  team("padres", "パドレス", "パドレス"),
  team("cubs", "カブス", "カブス"),
  team("mariners", "マリナーズ", "マリナーズ"),
  team("yankees", "ヤンキース", "ヤンキース"),
  team("mets", "メッツ", "メッツ"),
  team("angels", "エンゼルス", "エンゼルス"),
  team("bluejays", "ブルージェイズ", "ブルージェイズ"),
  team("samurai-japan", "侍ジャパン", "侍ジャパン"),
  team("soccer-japan", "サッカー日本代表", "サッカー日本代表|森保ジャパン|森保監督"),
  team("nadeshiko", "なでしこジャパン", "なでしこ"),
  team("kashima", "鹿島アントラーズ", "鹿島|アントラーズ"),
  team("urawa", "浦和レッズ", "浦和"),
  team("kawasaki", "川崎フロンターレ", "川崎F|川崎Ｆ|フロンターレ"),
  team("marinos", "横浜F・マリノス", "横浜FM|横浜ＦＭ|マリノス"),
  team("gamba", "ガンバ大阪", "G大阪|Ｇ大阪|ガンバ"),
  team("vissel", "ヴィッセル神戸", "ヴィッセル|神戸"),
  team("sanfrecce", "サンフレッチェ広島", "サンフレッチェ"),
];

/** 国はどのジャンルの話題も集める。チームはスポーツの話題だけ（「巨人」「楽天」などは別の意味でも使われるため） */
export const TAG_GENRES: Record<TagKind, string[] | null> = { country: null, team: ["sports"] };

export const TAG_KIND_LABELS: Record<TagKind, { list: string; path: string }> = {
  country: { list: "国・地域別ニュース", path: "/country" },
  team: { list: "チーム別ニュース", path: "/team" },
};

export const tagPath = (t: Pick<Tag, "kind" | "slug">) => `${TAG_KIND_LABELS[t.kind].path}/${t.slug}`;

export function findTag(kind: TagKind, slug: string): Tag | undefined {
  return (kind === "country" ? COUNTRIES : TEAMS).find((t) => t.slug === slug);
}

/** 見出しがその国・チームのものか */
export function matchesTag(tag: Tag, text: string): boolean {
  const t = text.normalize("NFKC");
  return new RegExp(tag.pattern).test(t) && !(tag.exclude && new RegExp(tag.exclude).test(t));
}

/** 見出しの一覧から、国・チームごとの話題の数を数える（多い順、0件は除く） */
export function countTags(tags: Tag[], titles: string[]): { tag: Tag; count: number }[] {
  return tags
    .map((tag) => ({ tag, count: titles.filter((t) => matchesTag(tag, t)).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}
