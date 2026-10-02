/** 値上げ・値下げデータベースの日付の扱い（画面からも使うので DB に依存しない） */

/** 日付（YYYY-MM-DD）どうしの日数の差 */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** これから始まるものか（月までしか分からないものは、今月以降なら「これから」に入れる） */
export function isUpcoming(date: string, today: string): boolean {
  return date.length === 7 ? date >= today.slice(0, 7) : date >= today;
}

/** 始まるまでの目安（きょうから・あすから・あと◯日・◯月中） */
export function countdown(date: string, today: string): string {
  if (date.length === 7) return `${Number(date.slice(5))}月中`;
  const d = daysBetween(today, date);
  if (d <= 0) return "きょうから";
  if (d === 1) return "あすから";
  return `あと${d}日`;
}
