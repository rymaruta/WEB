import { hasCronSecret } from "@/lib/auth";
import { resolveTopicPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 最近の話題に人物写真（自由利用ライセンス）を付ける（スケジューラーが10分ごとに呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await resolveTopicPhotos());
}
