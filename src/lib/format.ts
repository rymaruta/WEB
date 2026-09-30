const TZ = "Asia/Tokyo";

const dateTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TZ,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const fullDateTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** 「5分前」「3時間前」、24時間以上前は「9/30 21:00」 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return dateTime.format(date);
}

export function formatDateTime(date: Date): string {
  return fullDateTime.format(date);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}
