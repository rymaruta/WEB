import Link from "next/link";
import { Thumbnail } from "@/components/thumbnail";
import { relativeTime } from "@/lib/format";
import { channelById, videoPath, viewsLabel } from "@/lib/youtube-channels";

type Video = { videoId: string; channelId: string; title: string; publishedAt: Date; views: number; isShort: boolean; thumbnail: string };

/** 動画のカード（サムネイル・題名・チャンネル・再生回数）。押すと動画のページへ */
export function VideoCard({ v, showChannel = true, note }: { v: Video; showChannel?: boolean; note?: string }) {
  return (
    <Link href={videoPath(v.videoId)} prefetch={false} className="group block">
      <span className="relative block overflow-hidden rounded-lg">
        <Thumbnail src={v.thumbnail} genreSlug="entertainment" className="aspect-video w-full" sizes="(max-width: 640px) 50vw, 300px" />
        {v.isShort && <span className="absolute top-1.5 left-1.5 rounded bg-red-600 px-1.5 text-[10px] leading-4 font-bold text-white">ショート</span>}
      </span>
      <span className="mt-1.5 line-clamp-2 text-sm leading-snug font-bold group-hover:text-accent">{v.title}</span>
      <span className="mt-0.5 block text-[11px] text-fg-subtle">
        {showChannel && <>{channelById(v.channelId)?.name ?? ""}・</>}
        {viewsLabel(v.views)}・{relativeTime(v.publishedAt)}
        {note && <span className="ml-1 font-bold text-accent">{note}</span>}
      </span>
    </Link>
  );
}

/** 1行の動画（小さなサムネイルの横に題名）。ランキングなど、縦に並べる一覧に使う */
export function VideoRow({ v, rank, note }: { v: Video; rank?: number; note?: string }) {
  return (
    <Link href={videoPath(v.videoId)} prefetch={false} className="group flex items-center gap-3">
      {rank !== undefined && <span className="w-5 shrink-0 text-center text-sm font-black text-accent tabular-nums">{rank}</span>}
      <span className="relative w-32 shrink-0 overflow-hidden rounded-md">
        <Thumbnail src={v.thumbnail} genreSlug="entertainment" className="aspect-video w-full" sizes="128px" />
        {v.isShort && <span className="absolute top-1 left-1 rounded bg-red-600 px-1 text-[9px] leading-4 font-bold text-white">ショート</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug font-bold group-hover:text-accent">{v.title}</span>
        <span className="mt-0.5 block text-[11px] text-fg-subtle">
          {channelById(v.channelId)?.name ?? ""}
          {note && <span className="ml-1 font-bold text-accent">{note}</span>}
        </span>
      </span>
    </Link>
  );
}

/** 動画カードを2列（広い画面は3列）に並べる */
export function VideoGrid({ videos, showChannel = true }: { videos: Video[]; showChannel?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
      {videos.map((v) => (
        <VideoCard key={v.videoId} v={v} showChannel={showChannel} />
      ))}
    </div>
  );
}
