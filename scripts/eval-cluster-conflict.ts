/**
 * 話題のまとめ方で、別の人・別の大会の見出しをまとめない判定（src/lib/topics/conflict.ts）の影響を比べる。
 * 使い方: DATABASE_URL=... npx tsx scripts/eval-cluster-conflict.ts （読み取りのみ）
 */
import pg from "pg";
import { assignTopics } from "../src/lib/topics/assign";

async function main() {
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(`SELECT id, title, "publishedAt", publisher FROM "Article" ORDER BY "publishedAt" LIMIT 20000`);
await c.end();
const docs = r.rows.map((x) => ({ id: x.id as number, title: x.title as string, publishedAt: x.publishedAt as Date, publisher: x.publisher as string, topicId: null }));
const group = (on: boolean) => {
  const res = assignTopics(docs, { conflictCheck: on });
  const g = new Map<string, number[]>();
  for (const d of docs) g.set(String(res.get(d.id)), [...(g.get(String(res.get(d.id))) ?? []), d.id]);
  return { res, g };
};
const before = group(false);
const after = group(true);
const title = new Map(docs.map((d) => [d.id, d.title]));
// 変更前に同じ話題だった記事の組のうち、変更後に分かれたもの
let split = 0;
const examples: string[] = [];
for (const ids of before.g.values()) {
  if (ids.length < 2) continue;
  const keys = new Set(ids.map((id) => String(after.res.get(id))));
  if (keys.size > 1) {
    split++;
    if (examples.length < 15) examples.push(ids.map((id) => `  ${title.get(id)}`).join("\n"));
  }
}
console.log(`記事 ${docs.length} 本／話題（変更前）${before.g.size}・（変更後）${after.g.size}／分かれた話題 ${split}`);
console.log(examples.join("\n---\n"));
}

main();
