import { prisma } from "@/lib/db";

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

function isPrefetch(request: Request) {
  const h = request.headers;
  return (h.get("purpose") ?? h.get("sec-purpose") ?? "").includes("prefetch") || h.has("next-router-prefetch");
}

/** 元記事へのリダイレクト。人による閲覧のみクリック数に加算する */
export async function GET(request: Request, { params }: RouteContext<"/go/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) {
    return new Response("Not Found", { status: 404 });
  }
  const article = await prisma.article.findUnique({ where: { id }, select: { url: true } });
  if (!article) return new Response("Not Found", { status: 404 });

  const ua = request.headers.get("user-agent") ?? "";
  if (ua && !BOT_UA.test(ua) && !isPrefetch(request)) {
    await prisma.article.update({ where: { id }, data: { clicks: { increment: 1 } } });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: article.url,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "origin",
    },
  });
}
