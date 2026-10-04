import { AdsenseScript } from "@/components/adsense-script";
import type { Metadata } from "next";
import Link from "next/link";
import { FollowButton } from "./follow-button";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { TopicList } from "@/components/topic-card";
import { formatNumber } from "@/lib/format";
import { getTagTopics } from "@/lib/queries";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { findTag, tagPath, type TagKind } from "@/lib/tags";

const PER_PAGE = 20;

/** 国・チームのページから戻るジャンルのページ */
const PARENT: Record<TagKind, { name: string; path: string }> = {
  country: { name: "国際", path: "/genre/world" },
  team: { name: "スポーツ", path: "/genre/sports" },
};

export async function tagMetadata(kind: TagKind, slug: string): Promise<Metadata> {
  const tag = findTag(kind, slug);
  if (!tag) return {};
  const { total } = await getTagTopics(tag, 0, 1);
  if (total === 0) return {};
  return {
    title: `${tag.name}のニュース`,
    description: `${tag.name}に関する最新ニュースを、複数の媒体の報道からまとめて新しい順にお届けします。`,
    alternates: { canonical: tagPath(tag) },
    robots: total < 2 ? { index: false, follow: true } : undefined,
  };
}

/** 国別・チーム別のページ。見出しにその国・チームが入った話題を新しい順に並べる */
export async function TagTopics({ kind, slug, page }: { kind: TagKind; slug: string; page: number }) {
  const tag = findTag(kind, slug);
  if (!tag) notFound();
  const { items, total } = await getTagTopics(tag, (page - 1) * PER_PAGE, PER_PAGE);
  if (items.length === 0) notFound();
  const parent = PARENT[kind];

  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      {/* 広告は、検索エンジンに登録する（内容のある）ページだけ。移動用の一覧や中身の少ないページには出さない */}
      {total >= 2 && <AdsenseScript />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: parent.name, path: parent.path },
              { name: tag.name, path: tagPath(tag) },
            ]),
          ),
        }}
      />
      <nav aria-label="パンくず" className="mb-2 flex items-center gap-1.5 text-xs text-fg-subtle">
        <Link href="/" className="hover:text-fg">トップ</Link>
        <span>›</span>
        <Link href={parent.path} className="hover:text-fg">{parent.name}</Link>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{tag.name}のニュース</h1>
        <FollowButton follow={{ kind: tag.kind, key: tag.slug, label: tag.name }} />
      </div>
      <p className="mt-1 mb-2 text-sm text-fg-muted">
        直近3か月で{tag.name}を取り上げた話題 {formatNumber(total)}件（新しい順）。各社の報道をまとめた記事を読めます。
      </p>
      <TopicList topics={items} />
      <Pagination page={page} totalPages={Math.min(50, Math.ceil(total / PER_PAGE))} href={(p) => `${tagPath(tag)}${p > 1 ? `?page=${p}` : ""}`} />
    </section>
  );
}
