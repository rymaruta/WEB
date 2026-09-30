/** 大量の行を1文にまとめて送るときの分割（PostgreSQL のパラメータ上限 65535 を超えないようにする） */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
