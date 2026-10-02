/** 「◯月から変わること」の種類（画面からも使うので DB に依存しない） */

export const CHANGE_KINDS = ["price_up", "price_down", "rule", "start", "end", "other"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  price_up: "値上げ",
  price_down: "値下げ",
  rule: "制度・法律",
  start: "開始",
  end: "終了",
  other: "変更",
};

export type ChangeItem = { topicId: number; title: string; date: string; kind: ChangeKind };
