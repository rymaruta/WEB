/**
 * 媒体の利用規約に基づく、記事の見せ方の決まり（2026年10月3日に各媒体の利用規約・サイトポリシーを確認）。
 *
 * - 画像: RSS の画像を、出典（媒体名）を明記して媒体のサーバーから表示する（保存・加工はしない。運営者の判断、2026-10-03）。
 *   ただし、規約で画像ファイルへの直接リンクを名指しで禁じる媒体と、利用規約で営利利用・AI での利用を禁じて収集を止めた媒体の画像は出さない
 * - 説明文（RSS の description の抜粋）: 営利のサイトでの利用を規約で認める媒体だけ表示する。
 *   ほかの媒体は見出し・媒体名・元記事へのリンクだけにし、要約は当サイトが書いたものだけを出す
 * - AI の資料: 要約・AI での利用を規約で禁じる媒体は、見出しだけを渡す（説明文を渡さない）
 *
 * 許諾を得た媒体は、ここに加える。
 */

/** 説明文の表示を規約で認める媒体（4Gamer.net: 営利サイトでの RSS 利用を明記。PR TIMES: 報道目的の利用を許諾） */
const EXCERPT_ALLOWED = new Set(["4Gamer.net", "PR TIMES"]);

/**
 * 画像を出さない媒体。
 * 規約で画像への直接リンクを名指しで禁じる（または禁止できると定める）媒体と、利用規約により収集を止めた媒体（prisma/catalog.ts の TERMS）
 */
const IMAGE_BLOCKED = new Set<string>([
  // 画像への直接リンクの禁止を明記
  "Impress Watch",
  "ライブドアニュース",
  "BASEBALL KING",
  "サッカーキング",
  "バスケットボールキング",
  "WEDGE ONLINE",
  "Business Insider Japan",
  "ギズモード・ジャパン",
  "任天堂",
  "AUTOMATON",
  "Sirabee",
  "ライフハッカー・ジャパン",
  // 利用規約により収集を止めた媒体
  "時事ドットコム",
  "BBCニュース",
  "東洋経済オンライン",
  "ダイヤモンド・オンライン",
  "現代ビジネス",
  "女性自身",
  "ゲキサカ",
]);

/** 要約・AI での利用を規約で禁じる媒体 */
const NO_AI_SUMMARY = /時事|東洋経済|ダイヤモンド|現代ビジネス|ゲキサカ|BBC|女性自身/;

/** 媒体の説明文を表示してよければ返す */
export function displayExcerpt(summary: string | null | undefined, publisher: string): string | null {
  return summary && EXCERPT_ALLOWED.has(publisher) ? summary : null;
}

/** 媒体の画像を表示してよければ返す（表示するときは、画像の出典として媒体名を必ず添える） */
export function displayImage(url: string | null | undefined, publisher: string): string | null {
  return url && !IMAGE_BLOCKED.has(publisher) ? url : null;
}

/** AI に渡してよい説明文（禁じる媒体は渡さない） */
export function aiSummary(summary: string | null | undefined, publisher: string): string | null {
  return summary && !NO_AI_SUMMARY.test(publisher) ? summary : null;
}
