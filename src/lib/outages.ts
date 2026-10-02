/**
 * IT のページの「障害・不具合情報」。通信・アプリ・ネットのサービスの障害を、見出しの言葉で見分ける（AI は使わない）。
 * 「障害者」「発達障害」のように、サービスの障害ではない言葉は除く
 */

const OUTAGE_RE = /障害|不具合|つながりにくい|つながらない|繋がらない|ログインできない|利用できない|サービス停止|システムトラブル|大規模な?ダウン|復旧/;
const NOT_OUTAGE_RE =
  /障害者|障がい|障害物|障害児|障害年金|発達障害|睡眠障害|摂食障害|機能障害|意識障害|健康障害|聴覚障害|視覚障害|記憶障害|認知障害|適応障害|双極性障害|強迫性障害|パニック障害|学習障害|性同一性障害|嚥下障害|傷害|災害からの復旧|復旧工事|復興/;
/** サービスの障害らしさ（どれかがあること）。「障害」だけでは病気の話などと区別できないため */
const SERVICE_RE = /通信|システム|サーバー|アプリ|サービス|ネット|回線|ログイン|決済|アクセス|API|クラウド|AWS|Azure|Google|X（旧|Xで|Xが|旧ツイッター|LINE|ドコモ|au|ソフトバンク|楽天モバイル|povo|ahamo|ゲーム|PSN|Nintendo|Microsoft|Windows|iPhone|iOS|Android|ChatGPT|Claude|Gemini|Slack|Zoom|Teams|YouTube|Instagram|Discord|銀行|ATM|交通系|Suica|PayPay/;

export function isOutage(title: string): boolean {
  const t = title.normalize("NFKC");
  return OUTAGE_RE.test(t) && SERVICE_RE.test(t) && !NOT_OUTAGE_RE.test(t);
}

export type OutageStatus = "recovered" | "ongoing";

/** 見出しに「復旧」とあれば復旧済み、なければ発生中として出す */
export function outageStatus(title: string): OutageStatus {
  return /復旧(した|しました|済|$|。|、| )|復旧へ|全面復旧|復旧完了|解消|修正/.test(title.normalize("NFKC")) ? "recovered" : "ongoing";
}

export const OUTAGE_STATUS_LABELS: Record<OutageStatus, string> = { recovered: "復旧", ongoing: "発生" };

export type OutageItem = { topicId: number; title: string; status: OutageStatus; at: string };
