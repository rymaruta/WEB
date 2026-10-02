import { hasCronSecret } from "@/lib/auth";
import { dispatchRoutines } from "@/lib/digest/dispatch";

export const dynamic = "force-dynamic";

/** 仕事がたまった定期実行（まとめ記事・ダイジェスト用の解析）を起動する（スケジューラーが5分ごとに呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await dispatchRoutines());
}
