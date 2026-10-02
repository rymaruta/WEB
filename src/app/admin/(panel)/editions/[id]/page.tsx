import Link from "next/link";
import { notFound } from "next/navigation";
import { candidatePool, editionDetail } from "@/lib/digest/admin";
import { prisma } from "@/lib/db";
import { blueskyCredentialsFromEnv, blueskyPostUrl } from "@/lib/social/bluesky";
import { autoApproveEnabled, isBeforeBuild, isPastPublish, jstTime, SLOTS, type Slot } from "@/lib/digest/slots";
import { CATEGORY_LABELS, type Category } from "@/lib/stories/schema";
import {
  addAction,
  approveAction,
  bulkConfirmAction,
  confirmAction,
  editAction,
  moveAction,
  postTextAction,
  publishAfterTimeAction,
  publishNowAction,
  rebuildAction,
  cancelAction,
  removeAction,
  retryBlueskyAction,
  unapproveAction,
} from "../../../actions";
import { ActionButton, EditForm, PostTextForm } from "./controls";

export default async function EditionPage({ params }: PageProps<"/admin/editions/[id]">) {
  const { id } = await params;
  const detail = await editionDetail(id);
  if (!detail) notFound();
  const { edition, items, cards, parts, title } = detail;
  const editable = edition.status === "DRAFT" || edition.status === "SKIPPED";
  const pool = editable ? await candidatePool(id) : [];
  // 下書きを作る時刻の前か（取り消すと、その時刻に自動で作り直される）
  const buildPending = isBeforeBuild(edition.date, edition.slot as Slot);
  // 投稿の時刻を過ぎた回は、承認しても自動では投稿されない（今すぐ投稿するボタンを出す）
  const pastTime = isPastPublish(edition.scheduledAt);
  const needReview = items.filter((i) => i.story?.status === "REVIEW_REQUIRED" && !i.confirmed).length;
  const publication = await prisma.publication.findUnique({
    where: { editionId_channel: { editionId: id, channel: "X" } },
    include: { parts: { orderBy: { position: "asc" } } },
  });
  const bluesky = await prisma.publication.findUnique({
    where: { editionId_channel: { editionId: id, channel: "BLUESKY" } },
    include: { parts: { orderBy: { position: "asc" }, take: 1 } },
  });
  const blueskyHandle = blueskyCredentialsFromEnv()?.handle;

  return (
    <div className="space-y-5">
      <header>
        <Link href="/admin" className="text-sm text-fg-muted hover:text-fg">
          ← 配信一覧
        </Link>
        <h1 className="mt-1 text-xl font-extrabold">
          {title} <span className="text-base font-bold text-fg-muted tabular-nums">{edition.date} {jstTime(edition.scheduledAt)}</span>
        </h1>
        <p className="text-sm text-fg-muted">締め切り {jstTime(edition.deadlineAt)} ・ {items.length} 本</p>
      </header>

      {/* 承認 */}
      <section className="card p-4">
        {edition.status === "PUBLISHED" ? (
          <div className="space-y-1">
            <p className="font-bold">投稿しました。</p>
            {publication?.parts.map((p) =>
              p.externalId ? (
                <a key={p.position} href={`https://x.com/i/web/status/${p.externalId}`} target="_blank" rel="noopener noreferrer" className="block text-sm text-accent underline">
                  {p.position === 0 ? "本投稿を X で見る" : `リプライ ${p.position} を X で見る`}
                </a>
              ) : null,
            )}
            {/* Bluesky への同時投稿（設定済みのときだけ） */}
            {blueskyHandle &&
              (bluesky?.status === "PUBLISHED" && bluesky.parts[0]?.externalId ? (
                <a href={blueskyPostUrl(bluesky.parts[0].externalId, blueskyHandle)} target="_blank" rel="noopener noreferrer" className="block text-sm text-accent underline">
                  Bluesky で見る
                </a>
              ) : bluesky?.status === "FAILED" ? (
                <div className="space-y-1 pt-1">
                  <p className="whitespace-pre-line text-sm font-bold text-accent">
                    Bluesky への投稿に失敗しました（{bluesky.attempts}回）。{bluesky.lastError ? `\n${bluesky.lastError.slice(0, 200)}` : ""}
                  </p>
                  <ActionButton action={retryBlueskyAction.bind(null, id)} label="Bluesky に投稿し直す" />
                </div>
              ) : bluesky ? (
                <p className="text-sm text-fg-muted">Bluesky：投稿中です</p>
              ) : null)}
          </div>
        ) : edition.status === "APPROVED" || edition.status === "FAILED" ? (
          <div className="space-y-2">
            {edition.status === "APPROVED" ? (
              <p className="font-bold text-emerald-700 dark:text-emerald-400">
                {pastTime ? "承認済みですが、投稿の時刻を過ぎています。出すときは「今すぐ X に投稿する」を押してください。" : "承認済みです。予定の時刻に投稿されます。"}
              </p>
            ) : (
              <p className="whitespace-pre-line text-sm font-bold text-accent">投稿に失敗しました。{publication?.lastError ? `\n${publication.lastError}` : ""}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <ActionButton action={publishNowAction.bind(null, id)} label={edition.status === "FAILED" ? "続きを投稿する" : "今すぐ X に投稿する"} tone="primary" confirm="X に投稿します。よろしいですか？（取り消しはできません）" />
              {edition.status === "APPROVED" && <ActionButton action={unapproveAction.bind(null, id)} label="承認を取り消す" tone="danger" />}
            </div>
          </div>
        ) : editable ? (
          <div className="space-y-2">
            {pastTime ? (
              <p className="text-sm font-bold text-accent">
                投稿の時刻（{jstTime(edition.scheduledAt)}）を過ぎたため、この回は自動では投稿されません。出すときは「この内容で今すぐ投稿する」を押してください。カードの時刻は、投稿した時刻になります。
              </p>
            ) : edition.status === "DRAFT" && autoApproveEnabled() && needReview === 0 && (
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                おまかせ投稿です。確認しなくても {jstTime(edition.scheduledAt)} に自動で投稿されます。気になる点があるときだけ直してください。
              </p>
            )}
            {needReview > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-accent">
                  要確認のニュースが {needReview} 本あります。「まとめて確認」を押すと、中身に問題がないものは確認済みになります。残ったものだけ内容を確かめて「確認した」を押してください（確認されないままだと、この回は見送りになります）。
                </p>
                <ActionButton action={bulkConfirmAction.bind(null, id)} label="まとめて確認" tone="primary" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {pastTime ? (
                <ActionButton
                  action={publishAfterTimeAction.bind(null, id)}
                  label="この内容で今すぐ投稿する"
                  tone="primary"
                  confirm="この内容で、いますぐ X に投稿します。カードの時刻は投稿した時刻になります。よろしいですか？（取り消しはできません）"
                />
              ) : (
                <ActionButton action={approveAction.bind(null, id)} label="この内容で承認する" tone="primary" />
              )}
              <ActionButton action={rebuildAction.bind(null, id)} label="選び直す" confirm="今の下書きを捨てて、候補から選び直しますか？" />
              <ActionButton
                action={cancelAction.bind(null, id)}
                label="この下書きを取り消す"
                tone="danger"
                confirm={
                  buildPending
                    ? `この下書きを取り消します。${SLOTS[edition.slot as Slot].buildAt} に自動で作り直されます。よろしいですか？`
                    : "この下書きを取り消します。下書きを作る時刻を過ぎているため、自動では作り直されません（配信一覧の「下書きを今すぐ作る」から作れます）。よろしいですか？"
                }
              />
            </div>
          </div>
        ) : (
          <p className="font-bold text-fg-muted">この配信回は変更できません（{edition.status}）。</p>
        )}
      </section>

      {/* 投稿のプレビュー */}
      <section className="space-y-3">
        <h2 className="font-extrabold">投稿のプレビュー</h2>
        {parts.map((part, i) => (
          <div key={i} className="card p-3">
            <p className="mb-2 text-xs font-bold text-fg-muted">{i === 0 ? "本投稿" : "リプライ"}</p>
            <p className="mb-2 whitespace-pre-line text-[15px]">{part.text}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {part.cards.map((n) => (
                // カード画像は管理画面専用の API から読む（ログインの Cookie で認証）
                // eslint-disable-next-line @next/next/no-img-element
                <img key={n} src={`/api/admin/editions/${id}/cards/${n}?v=${edition.updatedAt.getTime()}`} alt={cards[n]?.alt ?? ""} loading="lazy" className="aspect-square w-full rounded-md border border-border" />
              ))}
            </div>
          </div>
        ))}
        {editable && (
          <div className="card p-3">
            <p className="mb-2 text-sm font-bold">投稿文を直す</p>
            <PostTextForm action={postTextAction.bind(null, id)} initial={edition.postText.join("\n")} />
          </div>
        )}
      </section>

      {/* 載せるニュース */}
      <section className="space-y-3">
        <h2 className="font-extrabold">載せるニュース</h2>
        {items.map((item, i) => {
          const e = item.entry;
          const review = item.story?.status === "REVIEW_REQUIRED";
          const sameRole = (j: number) => items[j]?.role === item.role;
          return (
            <article key={item.storyId} className={`card p-4 ${review && !item.confirmed ? "border-accent" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-fg-muted">
                    {item.position}. {item.role === "FOLLOWUP" ? "続報" : e.category ? CATEGORY_LABELS[e.category as Category] : ""}
                    {review && <span className="ml-2 text-accent">{item.confirmed ? "確認済み" : "要確認"}</span>}
                  </p>
                  <h3 className="font-bold leading-snug">{e.headline.join(" ")}</h3>
                  <ul className="mt-1 list-disc pl-5 text-sm text-fg-muted">
                    {(e.delta ? [`前回: ${e.delta.before}`, `現在: ${e.delta.now.text}`] : e.points.map((p) => p.text)).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  {e.why && <p className="mt-1 text-sm">なぜ重要: {e.why.text}</p>}
                  {review && item.story?.statusNote && <p className="mt-2 whitespace-pre-line rounded bg-surface-muted p-2 text-xs">{item.story.statusNote}</p>}
                </div>
              </div>
              {editable && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {sameRole(i - 1) && <ActionButton action={moveAction.bind(null, id, item.position, -1)} label="↑" />}
                  {sameRole(i + 1) && <ActionButton action={moveAction.bind(null, id, item.position, 1)} label="↓" />}
                  {review && <ActionButton action={confirmAction.bind(null, id, item.storyId, !item.confirmed)} label={item.confirmed ? "確認を取り消す" : "確認した"} tone={item.confirmed ? "plain" : "primary"} />}
                  <ActionButton action={removeAction.bind(null, id, item.storyId)} label="外す" tone="danger" confirm="このニュースを外しますか？" />
                </div>
              )}
              {editable && item.role === "MAIN" && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-bold text-fg-muted">文面を直す</summary>
                  <EditForm
                    action={editAction.bind(null, id, item.storyId)}
                    initial={{
                      headline: e.headline.join("\n"),
                      shortTitle: e.shortTitle,
                      keyword: e.keyword,
                      points: e.points.map((p) => p.text).join("\n"),
                      why: e.why?.text ?? "",
                    }}
                  />
                </details>
              )}
            </article>
          );
        })}
      </section>

      {/* 候補 */}
      {editable && pool.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-extrabold">候補から追加</h2>
          <ul className="divide-y divide-border card">
            {pool.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-fg-muted tabular-nums">
                    {c.score.toFixed(0)} 点 ・ {c.story.kind === "FOLLOWUP" ? "続報" : c.story.category ? CATEGORY_LABELS[c.story.category as Category] : ""}
                    {c.story.status === "REVIEW_REQUIRED" && <span className="ml-1 text-accent">要確認</span>}
                  </p>
                  <p className="truncate text-sm font-bold">{c.story.shortTitle ?? c.story.headline.join(" ")}</p>
                </div>
                <ActionButton action={addAction.bind(null, id, c.id)} label="追加" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
