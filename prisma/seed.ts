import "dotenv/config";
import { prisma } from "../src/lib/db";
import { genres, sources } from "./catalog";

async function main() {
  for (const [i, g] of genres.entries()) {
    await prisma.genre.upsert({
      where: { slug: g.slug },
      update: { name: g.name, sortOrder: i },
      create: { slug: g.slug, name: g.name, sortOrder: i },
    });
  }
  const genreIds = new Map(
    (await prisma.genre.findMany()).map((g) => [g.slug, g.id]),
  );

  for (const s of sources) {
    const genreId = genreIds.get(s.genre);
    if (!genreId) throw new Error(`未知のジャンル: ${s.genre} (${s.name})`);
    const data = {
      name: s.name,
      publisher: s.publisher,
      siteUrl: s.siteUrl,
      kind: s.kind ?? "NEWS",
      genreId,
      active: s.active ?? true,
      lastError: s.active === false ? (s.disabledReason ?? null) : undefined,
    } as const;
    await prisma.source.upsert({
      where: { feedUrl: s.feedUrl },
      update: data,
      create: { ...data, feedUrl: s.feedUrl },
    });
  }

  // カタログから外したフィードは削除せず停止する（収集済み記事を残すため）
  const { count } = await prisma.source.updateMany({
    where: { feedUrl: { notIn: sources.map((s) => s.feedUrl) } },
    data: { active: false },
  });

  console.log(
    `ジャンル ${genres.length} 件 / フィード ${sources.length} 件を登録${count ? `（停止 ${count} 件）` : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
