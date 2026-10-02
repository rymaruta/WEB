import { clickCookie, isBot, recentClicks } from "@/lib/bots";
import { prisma } from "@/lib/db";

function isPrefetch(request: Request) {
  const h = request.headers;
  return (h.get("purpose") ?? h.get("sec-purpose") ?? "").includes("prefetch") || h.has("next-router-prefetch");
}

/**
 * 元記事へのリダイレクト。人による閲覧のみクリック数に加算する（同じ人が30分以内に同じ記事を開き直しても1回）。
 * ?to=summary のときは、AI まとめ記事があればサイト内のまとめページへ送る（なければ元記事へ）
 */
export async function GET(request: Request, { params }: RouteContext<"/go/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) {
    return new Response("Not Found", { status: 404 });
  }
  const article = await prisma.article.findUnique({
    where: { id },
    select: { url: true, topicId: true, topic: { select: { aiGeneratedAt: true } } },
  });
  if (!article) return new Response("Not Found", { status: 404 });

  const recent = recentClicks(request.headers.get("cookie"));
  const counted = !isBot(request.headers.get("user-agent")) && !isPrefetch(request) && !recent.includes(id);
  if (counted) await prisma.article.update({ where: { id }, data: { clicks: { increment: 1 } } });

  const toSummary = new URL(request.url).searchParams.get("to") === "summary" && article.topicId && article.topic?.aiGeneratedAt;
  return new Response(null, {
    status: 302,
    headers: {
      // サイト内へは相対パスで返す（コンテナ内のホスト名が URL に入らないように）
      Location: toSummary ? `/topic/${article.topicId}` : article.url,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "origin",
      ...(counted ? { "Set-Cookie": clickCookie(recent, id) } : {}),
    },
  });
}
