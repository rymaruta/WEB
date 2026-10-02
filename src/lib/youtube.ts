import { z } from "zod";
import { prisma } from "@/lib/db";
import { jstDate } from "@/lib/calendar";
import { extractFacts, factInSources } from "@/lib/stories/verify";
import { channelById, VIDEO_CATEGORIES, YOUTUBE_CHANNELS, type YouTubeChannel } from "@/lib/youtube-channels";

/**
 * YouTube の新着動画。決めたチャンネルの公式の新着情報（RSS。最新の15本）から、題名・説明文・公開日時・再生回数・サムネイルを取り込む。
 * 動画そのものは保存せず、画面では YouTube 公式の埋め込みプレーヤーで再生する
 */

export { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS, YOUTUBE_CHANNELS, findChannel, videoPath, viewsLabel, youtubeWatchUrl } from "@/lib/youtube-channels";

const UA = "ZenbuNaviBot/1.0 (+https://zenbu-navi.com/about)";

export type FeedVideo = { videoId: string; channelId: string; title: string; description: string; publishedAt: Date; views: number; isShort: boolean; thumbnail: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decode(m[1]) : "";
};

/** 新着情報（Atom）を読む */
export function parseYouTubeFeed(xml: string): FeedVideo[] {
  const out: FeedVideo[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const videoId = tag(e, "yt:videoId");
    const channelId = tag(e, "yt:channelId");
    const published = new Date(tag(e, "published"));
    if (!/^[\w-]{11}$/.test(videoId) || !channelId || Number.isNaN(published.getTime())) continue;
    const link = /<link rel="alternate" href="([^"]+)"/.exec(e)?.[1] ?? "";
    out.push({
      videoId,
      channelId,
      title: tag(e, "title"),
      description: tag(e, "media:description").slice(0, 5000),
      publishedAt: published,
      views: Number(/<media:statistics views="(\d+)"/.exec(e)?.[1] ?? 0),
      isShort: link.includes("/shorts/"),
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }
  return out;
}

async function fetchChannel(c: YouTubeChannel): Promise<FeedVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${c.id}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${c.slug}: HTTP ${res.status}`);
  return parseYouTubeFeed(await res.text()).filter((v) => v.channelId === c.id);
}

/** 定期処理。全チャンネルの新着を取り込み、再生回数を日ごとに記録する */
export async function syncYouTube(now = new Date()) {
  const date = jstDate(now);
  const results: Record<string, number | string> = {};
  for (const c of YOUTUBE_CHANNELS) {
    try {
      const videos = await fetchChannel(c);
      for (const v of videos) {
        const { videoId, ...data } = v;
        await prisma.youTubeVideo.upsert({ where: { videoId }, create: { videoId, ...data }, update: { title: data.title, description: data.description, views: data.views, isShort: data.isShort } });
        await prisma.youTubeViewDaily.upsert({ where: { videoId_date: { videoId, date } }, create: { videoId, date, views: v.views }, update: { views: v.views } });
      }
      results[c.slug] = videos.length;
    } catch (e) {
      results[c.slug] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return results;
}

export type VideoItem = Awaited<ReturnType<typeof getChannelVideos>>[number];

/** チャンネルの動画（新しい順） */
export function getChannelVideos(channelId: string, take = 30) {
  return prisma.youTubeVideo.findMany({ where: { channelId }, orderBy: { publishedAt: "desc" }, take });
}

export function getVideo(videoId: string) {
  return prisma.youTubeVideo.findUnique({ where: { videoId } });
}

/** すべてのチャンネルの新着（新しい順） */
export function getLatestVideos(take = 12, shorts?: boolean) {
  return prisma.youTubeVideo.findMany({ where: shorts === undefined ? {} : { isShort: shorts }, orderBy: { publishedAt: "desc" }, take });
}

/**
 * 再生数の伸びのランキング。直近 days 日に公開された動画の、昨日から今日までに増えた再生回数の多い順
 * （昨日の記録がない新しい動画は、今の再生回数をそのまま伸びとして数える）
 */
export async function getRisingVideos(take = 5, days = 7, now = new Date()) {
  const yesterday = jstDate(now, -1);
  const videos = await prisma.youTubeVideo.findMany({ where: { publishedAt: { gte: new Date(now.getTime() - days * 86_400_000) } }, take: 200 });
  if (videos.length === 0) return [];
  const before = await prisma.youTubeViewDaily.findMany({ where: { date: yesterday, videoId: { in: videos.map((v) => v.videoId) } } });
  const prev = new Map(before.map((b) => [b.videoId, b.views]));
  return videos
    .map((v) => ({ ...v, gain: Math.max(0, v.views - (prev.get(v.videoId) ?? 0)) }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, take);
}

/** 人気の動画（直近 days 日に公開された動画の、再生回数の多い順。ショートを除く） */
export function getPopularVideos(take = 6, days = 30, now = new Date()) {
  return prisma.youTubeVideo.findMany({ where: { isShort: false, publishedAt: { gte: new Date(now.getTime() - days * 86_400_000) } }, orderBy: { views: "desc" }, take });
}

/** ジャンルごとの新着（ショートを除く。ジャンルを判定した動画だけ） */
export async function getVideosByCategory(perCategory = 6) {
  const videos = await prisma.youTubeVideo.findMany({ where: { isShort: false, aiCategory: { not: null } }, orderBy: { publishedAt: "desc" }, take: 300 });
  const out = new Map<string, typeof videos>();
  for (const v of videos) {
    const list = out.get(v.aiCategory!) ?? [];
    if (list.length < perCategory) out.set(v.aiCategory!, [...list, v]);
  }
  return out;
}

/** その人のニュース（見出しに名前が入った話題。新しい順） */
export async function getChannelNews(c: YouTubeChannel, take = 10) {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Topic"
    WHERE "mergedIntoId" IS NULL AND "aiNotNews" = false
      AND "lastSeenAt" >= ${new Date(Date.now() - 180 * 86_400_000)}
      AND (title ~ ${c.keywords} OR COALESCE("aiTitle", '') ~ ${c.keywords})
    ORDER BY "lastSeenAt" DESC
    LIMIT ${take}`;
  if (rows.length === 0) return [];
  const { topicCardInclude } = await import("@/lib/queries");
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const topics = await prisma.topic.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: topicCardInclude });
  return topics.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export const channelOf = (v: { channelId: string }) => channelById(v.channelId);

// ---------------------------------------------------------------------------
// 紹介文（記事作成の定期処理が書く）
// ---------------------------------------------------------------------------

export const VideoSummarySchema = z.object({
  category: z
    .enum(VIDEO_CATEGORIES)
    .describe("動画のジャンル。challenge=検証・企画・ドッキリ、game=ゲーム実況・ゲーム紹介、review=商品紹介・開封・レビュー、food=料理・食べ物・グルメ、collab=ほかの人とのコラボが中心、vlog=日常・旅行・Vlog・雑談、music=歌・音楽、other=それ以外")
    .optional(),
  summary: z
    .string()
    .nullable()
    .describe("動画の紹介文（80〜150字、です・ます調）。題名と説明文に書かれていることだけで書く。書けるほどの情報がなければ null"),
});
export type VideoSummary = z.infer<typeof VideoSummarySchema>;

export const VIDEO_SUMMARY_SYSTEM = `あなたはエンタメニュースの編集者です。YouTube の動画の題名と説明文（チャンネルが書いたもの）だけを根拠に、動画の短い紹介文を書きます。
- 題名と説明文に書かれていることだけを書く。動画の中身を推測しない。見ていないことを見たように書かない。
- 人物の評価・噂・憶測は書かない。煽る言葉（衝撃、ヤバい、神回 など）を使わない。
- 説明文の宣伝・リンク・ハッシュタグ・SNS の案内は紹介文に入れない。
- 80〜150字、です・ます調。数字や固有名詞は、題名・説明文にあるものだけ。
- 題名だけで説明文がなく、紹介できることがない場合は summary を null にする。
- category は題名と説明文から選ぶ。紹介文を書かない（null の）ときも、題名から分かれば選ぶ。`;

export function buildVideoPrompt(v: { title: string; description: string; publishedAt: Date; channelId: string }) {
  const desc = v.description.replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").slice(0, 1500);
  return `チャンネル: ${channelById(v.channelId)?.name ?? ""}\n公開: ${v.publishedAt.toISOString().slice(0, 10)}\n題名: ${v.title}\n説明文:\n${desc || "（なし）"}`;
}

/** 紹介文を照合する。題名・説明文にない数字や固有名詞を含むもの、長すぎるもの、煽る言葉のあるものは使わない */
export function verifySummary(summary: string | null | undefined, source: { title: string; description: string; publishedAt: Date }): string | null {
  const s = summary?.trim();
  if (!s || [...s].length > 200) return null;
  if (/衝撃|ヤバ|やば|神回|閲覧注意|炎上/.test(s)) return null;
  const corpus = `${source.title}\n${source.description}\n${source.publishedAt.toISOString().slice(0, 10)}`;
  if (extractFacts(s).some((f) => !factInSources(f, corpus))) return null;
  return s;
}

/** 紹介文を書く候補（ショートでない、まだ確かめていない動画。新しい順） */
export function findVideoSummaryCandidates(limit: number) {
  return prisma.youTubeVideo.findMany({ where: { aiChecked: false, isShort: false }, orderBy: { publishedAt: "desc" }, take: limit });
}

export async function saveVideoSummary(videoId: string, result: VideoSummary) {
  const v = await prisma.youTubeVideo.findUnique({ where: { videoId } });
  if (!v) throw new Error("video not found");
  const summary = verifySummary(result.summary, v);
  await prisma.youTubeVideo.update({ where: { videoId }, data: { aiChecked: true, aiSummary: summary, aiCategory: result.category ?? null } });
  return { saved: summary };
}
