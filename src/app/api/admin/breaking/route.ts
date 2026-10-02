import { z } from "zod";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createManualBreaking,
  listBreakingCandidates,
} from "@/lib/digest/breaking";
import { checkOverride } from "@/lib/digest/check";
import { publishEdition, PublishError } from "@/lib/digest/publish";
import { editionKey, jstDate } from "@/lib/digest/slots";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** 速報の候補（管理画面の「速報」と同じ一覧） */
export async function GET(request: Request) {
  if (!hasCronSecret(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await listBreakingCandidates());
}

const Body = z.object({
  /** 速報にする出来事（ストーリー）。topicId でも指定できる */
  storyId: z.string().optional(),
  topicId: z.number().int().optional(),
  /** 投稿前に直す見出し（行ごと） */
  headline: z.array(z.string().min(1)).max(4).optional(),
});

/**
 * 選んだ出来事を、いますぐ速報として X に投稿する（管理画面の「速報」ボタンと同じ処理）。
 * 人が投稿を指示したときに、管理画面を開かずに出すための窓口
 */
export async function POST(request: Request) {
  if (!hasCronSecret(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "bad request" }, { status: 400 });
  const { storyId: sid, topicId, headline } = parsed.data;
  const story = sid
    ? await prisma.story.findUnique({
        where: { id: sid },
        select: { id: true },
      })
    : topicId
      ? await prisma.story.findFirst({
          where: { topicId, kind: "NEW" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;
  if (!story)
    return Response.json({ error: "story not found" }, { status: 404 });
  const problems = headline?.length ? checkOverride({ headline }) : [];
  if (problems.length)
    return Response.json({ error: problems }, { status: 400 });

  // 失敗した速報の出し直しは、同じ回の続きとして投稿する（二重に投稿しない）
  const existing = await prisma.edition.findUnique({
    where: { key: editionKey(jstDate(new Date()), "BREAKING", story.id) },
    select: { id: true, status: true },
  });
  if (existing?.status === "PUBLISHED")
    return Response.json({ error: "already published today" }, { status: 409 });
  const editionId =
    existing?.id ??
    (await createManualBreaking(story.id, new Date(), headline))?.id;
  if (!editionId)
    return Response.json(
      { error: "could not create edition" },
      { status: 500 },
    );
  try {
    const r = await publishEdition(editionId);
    return Response.json({
      editionId,
      ...r,
      url:
        "firstPostId" in r && r.firstPostId
          ? `https://x.com/i/web/status/${r.firstPostId}`
          : null,
    });
  } catch (e) {
    if (e instanceof PublishError)
      return Response.json({ editionId, error: e.message }, { status: 502 });
    throw e;
  }
}
