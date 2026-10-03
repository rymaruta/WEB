import type { Metadata } from "next";
import Link from "next/link";
import { verifyActionToken } from "@/lib/admin/token";
import { prisma } from "@/lib/db";
import { breakingPostText, draftHeadline } from "@/lib/digest/breaking";
import { jstTime } from "@/lib/digest/slots";
import { quickAiAction, quickPublishAction } from "../../actions";
import { AiRequestForm } from "../../(panel)/breaking/ai-request-form";
import { BreakingForm } from "../../(panel)/breaking/breaking-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "速報の候補", robots: { index: false, follow: false } };

/**
 * メールのリンクから開く、速報の候補1件の操作画面。ログインしなくても、この出来事の速報だけを操作できる
 * （リンクは署名付きで6時間だけ有効。開いただけでは何もせず、ボタンを押したときだけ動く）
 */
export default async function QuickBreakingPage({ params }: PageProps<"/admin/quick/[token]">) {
  const { token } = await params;
  const storyId = verifyActionToken(token);
  const story = storyId
    ? await prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true, status: true, headline: true, topic: { select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true } } },
      })
    : null;
  if (!story) {
    return (
      <main className="mx-auto max-w-xl p-4">
        <p className="card p-4 text-sm">リンクの有効期限が切れたか、候補が見つかりません。</p>
        <Link href="/admin/breaking" className="mt-3 inline-block text-sm underline">
          管理画面の「速報を作る」を開く
        </Link>
      </main>
    );
  }
  const headline = story.status === "QUEUED" ? draftHeadline(story.topic) : story.headline;
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-xl font-extrabold">速報の候補</h1>
      <section className="card space-y-3 p-4">
        <p className="font-bold leading-snug">{headline.join("")}</p>
        <p className="text-sm text-fg-muted">
          {story.topic.publisherCount}媒体 ・ 最初の報道 {jstTime(story.topic.firstSeenAt)}
          {story.status === "QUEUED" && <span className="ml-2 font-bold text-accent">AI 解析前</span>}
        </p>
        <Link href={`/topic/${story.topic.id}`} target="_blank" className="inline-block text-sm text-fg-muted underline">
          記事を確かめる ↗
        </Link>
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-sm font-bold">AI に任せる（無料・3〜5分）</p>
          <AiRequestForm action={quickAiAction.bind(null, token)} />
        </div>
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-sm font-bold">自分で見出しを直して、今すぐ投稿する</p>
          <pre className="mb-2 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap">{breakingPostText(headline, new Date()).join("\n")}</pre>
          <BreakingForm action={quickPublishAction.bind(null, token)} headline={headline} headlineOnly={story.status === "QUEUED"} />
        </div>
      </section>
    </main>
  );
}
