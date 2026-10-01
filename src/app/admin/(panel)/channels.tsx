import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { getChannelStatus } from "@/lib/social/status";
import { checkBlueskyAction, checkThreadsAction, threadsDailyNowAction } from "../actions";
import { ActionButton } from "./editions/[id]/controls";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs font-bold ${ok ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-fg-subtle text-fg-subtle"}`}
    >
      {label}
    </span>
  );
}

function Row({ name, children, badge }: { name: string; badge: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold">{name}</span>
        {badge}
      </div>
      {children && <div className="mt-1 space-y-1 text-sm text-fg-muted">{children}</div>}
    </li>
  );
}

const NOT_CONFIGURED = "鍵を Parameter Store に登録して再デプロイすると動き出します。";

/** 配信先（X・Bluesky・Threads）ごとの状態 */
export async function ChannelsSection() {
  const s = await getChannelStatus();
  const { bluesky, threads } = s;
  const daysLeft = threads.tokenDaysLeft;

  return (
    <section className="card p-4">
      <h2 className="mb-3 font-bold">配信先</h2>
      <ul className="divide-y divide-border">
        <Row name="X" badge={<Badge ok={s.x.configured} label={s.x.configured ? "稼働中" : "未設定"} />}>
          <p>1日3回（7:00・12:00・20:00）と速報</p>
          {s.x.lastPublishedAt && <p>最後の投稿 {formatDateTime(s.x.lastPublishedAt)}</p>}
        </Row>

        <Row name="Bluesky" badge={<Badge ok={bluesky.configured} label={bluesky.configured ? "稼働中" : "未設定"} />}>
          <p>X と同時に、同じ内容＋記事リンクで投稿</p>
          {bluesky.configured ? (
            <>
              <p>@{bluesky.handle}</p>
              <p>{bluesky.lastPublishedAt ? `最後の投稿 ${formatDateTime(bluesky.lastPublishedAt)}` : "まだ投稿していません"}</p>
              {bluesky.failure && (
                <p className="font-bold text-accent">
                  {formatDateTime(bluesky.failure.at)} に失敗（
                  <Link href={`/admin/editions/${bluesky.failure.editionId}`} className="underline">
                    {bluesky.failure.editionKey}
                  </Link>
                  ）：{bluesky.failure.error?.slice(0, 120)}
                </p>
              )}
              <ActionButton action={checkBlueskyAction} label="接続を確認する" />
            </>
          ) : (
            <p>{NOT_CONFIGURED}</p>
          )}
        </Row>

        <Row name="Threads" badge={<Badge ok={threads.configured} label={threads.configured ? "稼働中" : "未設定"} />}>
          <p>毎日 {threads.at} に「今日いちばん知っておきたいニュース」を1本</p>
          {threads.configured ? (
            <>
              {threads.daily ? (
                <p>
                  最後の投稿 {threads.daily.date}：{threads.daily.title ?? `話題 ${threads.daily.topicId}`}
                  {threads.daily.permalink && (
                    <>
                      {" "}
                      <a href={threads.daily.permalink} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        Threads で見る
                      </a>
                    </>
                  )}
                </p>
              ) : (
                <p>まだ投稿していません</p>
              )}
              {threads.failure && (
                <p className="font-bold text-accent">
                  {formatDateTime(threads.failure.at)} に失敗：{threads.failure.error.slice(0, 120)}
                </p>
              )}
              <p className={daysLeft !== null && daysLeft < 14 ? "font-bold text-accent" : ""}>
                {threads.token?.expiresAt
                  ? `鍵の期限 ${formatDateTime(threads.token.expiresAt)}ごろ（あと${daysLeft}日・7日ごとに自動で延長）`
                  : "鍵は登録から24時間後に自動で延長が始まります"}
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton action={checkThreadsAction} label="接続を確認する" />
                <ActionButton action={threadsDailyNowAction} label="今日の1本を今すぐ投稿" confirm="Threads に今日の1本を投稿します。よろしいですか？" />
              </div>
            </>
          ) : (
            <p>{NOT_CONFIGURED}</p>
          )}
        </Row>
      </ul>
    </section>
  );
}
