import "dotenv/config";
import { runCrawl } from "@/lib/crawl/run";
import { prisma } from "@/lib/db";

const force = process.argv.includes("--force");

runCrawl({ force })
  .then((s) => {
    for (const r of s.sources) {
      const detail = r.status === "error" ? `ERROR ${r.error}` : `${r.status} 取得${r.fetched} 新規${r.inserted}`;
      console.log(`${String(r.sourceId).padStart(3)} ${r.name.padEnd(24, "　")} ${detail}`);
    }
    const errors = s.sources.filter((r) => r.status === "error").length;
    console.log(
      `\nフィード ${s.sources.length}（失敗 ${errors}）/ 新規記事 ${s.inserted} / 割当 ${s.assigned} / 新規トピック ${s.topicsCreated} / スコア更新 ${s.topicsScored} / 削除 ${s.pruned} / ${(s.durationMs / 1000).toFixed(1)}s`,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
