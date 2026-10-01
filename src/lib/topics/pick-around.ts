/** 多すぎるときは、表示中の話題が必ず入るように、その前後を中心に切り出す */
export function pickAround<T extends { id: number }>(entries: T[], currentId: number, max: number): T[] {
  if (entries.length <= max) return entries;
  const at = Math.max(0, entries.findIndex((e) => e.id === currentId));
  const start = Math.min(Math.max(0, at - Math.floor(max / 2)), entries.length - max);
  return entries.slice(start, start + max);
}
