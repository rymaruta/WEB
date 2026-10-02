/**
 * 「いま一斉に報じられている出来事」の判定（速報の候補）。解析の順番・速報の候補の知らせに使う。
 * - 勢い: 最初の報道から1時間以内に4媒体以上（有名人の結婚発表のように、短時間に各社が追いかける出来事）
 * - 規模: 最初の報道から3時間以内に5媒体以上
 */
export const HOT = {
  fast: { minPublishers: 4, withinMinutes: 60 },
  wide: { minPublishers: 5, withinHours: 3 },
} as const;

/** DB で先に絞る条件（この範囲の外は、どちらの判定にも当てはまらない） */
export const HOT_QUERY = { minPublishers: HOT.fast.minPublishers, withinHours: HOT.wide.withinHours } as const;

export type HotInput = { publisherCount: number; firstSeenAt: Date; lastSeenAt?: Date | null };

export function isHot(t: HotInput, now = Date.now()): boolean {
  const age = now - t.firstSeenAt.getTime();
  if (age < 0 || age > HOT.wide.withinHours * 3_600_000) return false;
  if (t.publisherCount >= HOT.wide.minPublishers) return true;
  // 勢いの判定は、1時間以内に媒体がそろったかで見る（最後の報道の時刻があれば、それが1時間以内か）
  const spread = t.lastSeenAt ? t.lastSeenAt.getTime() - t.firstSeenAt.getTime() : age;
  return t.publisherCount >= HOT.fast.minPublishers && spread <= HOT.fast.withinMinutes * 60_000;
}
