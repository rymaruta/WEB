/**
 * トピックをすべて作り直す。まとめ方のパラメータ（src/lib/topics/assign.ts）を変更した後に実行する。
 * トピック ID が変わるため、公開中のサイトでは検索エンジン経由の /topic/<id> が 404 になる点に注意。
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { clusterArticles, rescoreTopics } from "@/lib/topics/cluster";

async function main() {
  await prisma.$transaction([
    prisma.article.updateMany({ data: { topicId: null } }),
    prisma.topic.deleteMany(),
  ]);
  const { assigned, created } = await clusterArticles();
  const scored = await rescoreTopics();
  console.log(`記事 ${assigned} 件を ${created} トピックに再構成（スコア更新 ${scored}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
