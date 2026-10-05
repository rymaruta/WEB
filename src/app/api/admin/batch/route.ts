import { z } from "zod";
import { hasCronSecret } from "@/lib/auth";
import { POST as postAnime } from "../anime/[id]/route";
import { POST as postArticle } from "../articles/[id]/route";
import { POST as postChange } from "../changes/[id]/route";
import { POST as postExplainer } from "../explainers/[id]/route";
import { POST as postGame } from "../games/[id]/route";
import { POST as postProduct } from "../products/[id]/route";
import { POST as postStory } from "../stories/[id]/route";
import { POST as postYoutube } from "../youtube/[id]/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Handler = (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

/** まとめて送れる窓口（1件ずつの窓口と同じ処理・同じ照合をそのまま使う） */
const HANDLERS: Record<string, Handler> = {
  stories: postStory as unknown as Handler,
  articles: postArticle as unknown as Handler,
  games: postGame as unknown as Handler,
  changes: postChange as unknown as Handler,
  products: postProduct as unknown as Handler,
  anime: postAnime as unknown as Handler,
  explainers: postExplainer as unknown as Handler,
  youtube: postYoutube as unknown as Handler,
};

/** 1回に送れる件数（処理の時間が長くなりすぎないように） */
const MAX_ITEMS = 50;

const Body = z.object({
  items: z
    .array(
      z.object({
        /** 送り先。"stories/<id>" "articles/<話題のid>" など、1件ずつの窓口の /api/admin/ より後ろ */
        path: z.string().regex(/^(stories|articles|games|changes|products|anime|youtube|explainers)\/[\w-]{1,40}$/),
        /** 1件ずつの窓口に送る内容（そのまま） */
        body: z.unknown(),
      }),
    )
    .min(1)
    .max(MAX_ITEMS),
});

/**
 * 解析・執筆の結果をまとめて受け取る（定期実行の AI が1件ずつ送る手間と、そのたびの読み込み＝トークンを減らすため）。
 * 各項目を、1件ずつの窓口（/api/admin/<path>）と同じ処理で順に保存し、項目ごとの結果（status と応答）を返す。
 * 1件が失敗しても、ほかの項目は続ける
 */
export async function POST(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });

  const auth = request.headers.get("authorization") ?? "";
  const origin = new URL(request.url).origin;
  const results = [];
  for (const item of parsed.data.items) {
    const [kind, id] = item.path.split("/");
    const sub = new Request(`${origin}/api/admin/${item.path}`, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify(item.body ?? null),
    });
    try {
      const res = await HANDLERS[kind](sub, { params: Promise.resolve({ id }) });
      results.push({ path: item.path, status: res.status, body: await res.json().catch(() => null) });
    } catch (e) {
      results.push({ path: item.path, status: 500, body: { error: e instanceof Error ? e.message : String(e) } });
    }
  }
  const ok = results.filter((r) => r.status < 300).length;
  return Response.json({ ok, failed: results.length - ok, results });
}
