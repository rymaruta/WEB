/**
 * 「速報になりうる大きな出来事」の判定。解析の順番・速報の候補の知らせに使う。
 * 速さを優先し、媒体がそろうのを待たない。次のどれかに当てはまる、最初の報道から3時間以内の出来事:
 * - 言葉: 見出しに大きな出来事を表す言葉（結婚・死去・引退・逮捕・優勝・地震など）がある（1媒体でも）
 * - 勢い: 最初の報道から1時間以内に4媒体以上がそろった
 * - 規模: 5媒体以上が報じた
 * 言葉だけで選ぶと小さな話題も入るため、出すかどうかは人が知らせを見て決める
 */
export const HOT = {
  withinHours: 3,
  fast: { minPublishers: 4, withinMinutes: 60 },
  wide: { minPublishers: 5 },
} as const;

/** 大きな出来事を表す言葉（人の節目・事件・災害・記録） */
const BIG_WORDS =
  /結婚|離婚|婚約|入籍|破局|熱愛|妊娠|出産|第[1-9１-９一二三]子|死去|急死|逝去|訃報|亡くなっ|引退|電撃|逮捕|書類送検|活動休止|脱退|解散|辞任|退任|辞職|優勝|金メダル|世界一|世界新|日本新|地震|津波|噴火|緊急事態|運転見合わせ|大規模障害/;
/** 言葉が入っていても、大きな出来事ではない言い方 */
const NOT_BIG = /結婚式場|婚活|優勝候補|優勝争い|引退試合|地震対策|地震保険|防災|ランキング|特集|まとめ|PR|セール/;

/**
 * 出来事の報道ではない見出し（雑誌のコラム・調査やアンケートの発表・インタビュー・推測の記事）。
 * 2026-10-07: 作家の生涯を振り返るコラム（「亡くなった」「離婚」を含む）や、女性1000名への調査の発表が速報の候補になり、
 * 1日の候補の枠を埋めていた
 */
const NOT_EVENT = /…|\.\.\.|｢|なぜ|とは[?？]?$|秘密|真実|調査[」』]?を発表|調査結果|名に聞いた|人に聞いた|アンケート|インタビュー|が語る|語った|証言|明かす|振り返る|コラム|解説|徹底|仰天|反響|騒然|ネットの声|SNSで話題|ファンが|ファン歓喜|喝采|エモい|か[」』]?$/;

/** 出来事の報道でない見出しか（コラム・調査・インタビュー・推測） */
export const isNotEventTitle = (title: string) => NOT_EVENT.test(title.normalize("NFKC").trim()) || /｢/.test(title);

/** 自動の速報では出さない分野（事件・訃報・政治。src/lib/digest/breaking.ts の excludedRisks）を表す言葉 */
const NOT_AUTO = /逮捕|書類送検|死去|急死|逝去|訃報|亡くなっ|辞任|辞職|退任|選挙/;
/** 事件・訃報・政治の言葉があるか（速報では、報道の広がりと信頼できる媒体で厳しく確かめる） */
export const isSensitiveTitle = (title: string) => NOT_AUTO.test(title);
/** 深夜でも自動で出す災害の言葉 */
const DISASTER = /地震|津波|噴火|緊急事態|台風|大雨|避難/;

/**
 * API（有料）で解析する価値があるか。自動の速報で出せる見込みのない話題には使わない。
 * - 事件・訃報・政治の言葉がある → 自動では出さないため、無料の定期実行に任せる
 * - 深夜（自動の速報を出さない時間）は、災害の言葉があるものだけ
 */
export function worthApi(title: string, { quiet }: { quiet: boolean }): boolean {
  if (NOT_AUTO.test(title)) return false;
  if (quiet) return isDisasterTitle(title);
  return true;
}

/** 災害の言葉があるか（誰にとっても関心のある出来事として、知名度を問わない） */
/**
 * 災害の言葉はあるが、災害そのものの報道ではない見出し（会議の資料・防災の取り組み・保険など）。
 * 2026-10-09: 文部科学省の「地震火山観測研究計画部会（第68回）配布資料」が災害の速報の候補になっていた
 */
const NOT_DISASTER_EVENT = /部会|審議会|検討会|委員会|会議|配布資料|議事|説明会|訓練|対策|防災|計画|保険|予防|啓発|シンポジウム|講演|募集|公募|入札|白書/;
/** 震度4以下の地震（速報にしない。震度4はほぼ毎週起きるため。運営者の方針 2026-10-09：地震の速報は震度5弱以上） */
const MINOR_QUAKE = (t: string) => /震度[1-4](?![0-9])/.test(t) && !/震度[5-7]/.test(t);

/** 速報にする災害の見出しか（災害の言葉があり、会議資料などでなく、震度4以下の地震でない） */
export const isDisasterTitle = (title: string) => {
  const t = title.normalize("NFKC");
  return DISASTER.test(t) && !NOT_DISASTER_EVENT.test(t) && !MINOR_QUAKE(t);
};

export function bigWord(title: string): string | null {
  if (NOT_BIG.test(title)) return null;
  return title.match(BIG_WORDS)?.[0] ?? null;
}

export type HotInput = { title?: string | null; publisherCount: number; firstSeenAt: Date; lastSeenAt?: Date | null };

/** 速報になりうる理由（当てはまらなければ null） */
export function hotReason(t: HotInput, now = Date.now()): string | null {
  const age = now - t.firstSeenAt.getTime();
  if (age < 0 || age > HOT.withinHours * 3_600_000) return null;
  // コラム・調査・インタビュー・推測の記事は、出来事の速報にしない（災害は除く）
  if (t.title && isNotEventTitle(t.title) && !isDisasterTitle(t.title)) return null;
  const word = t.title ? bigWord(t.title) : null;
  if (word) return `「${word}」`;
  if (t.publisherCount >= HOT.wide.minPublishers) return `${t.publisherCount}媒体が報道`;
  // 勢いは、1時間以内に媒体がそろったかで見る（最後の報道の時刻があれば、最初の報道からそこまでの時間）
  const spread = t.lastSeenAt ? t.lastSeenAt.getTime() - t.firstSeenAt.getTime() : age;
  if (t.publisherCount >= HOT.fast.minPublishers && spread <= HOT.fast.withinMinutes * 60_000) return `1時間で${t.publisherCount}媒体が報道`;
  return null;
}

export const isHot = (t: HotInput, now = Date.now()) => hotReason(t, now) !== null;
