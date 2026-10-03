import Link from "next/link";
import { elapsedLabel } from "@/lib/coverage";
import { formatDateTime } from "@/lib/format";
import { publisherLabel } from "@/lib/publisher";
import type { TopicUpdate, UpdateLink } from "@/lib/topics/updates";
import { OutboundLink } from "./outbound-link";
import { SinceRead } from "./since-read";

const CONTAINER = "topic-updates";

const KIND_LABEL: Record<TopicUpdate["kind"], string> = {
  reports: "新たな報道",
  facts: "続報で分かったこと",
  official: "公式の発表",
};

const KIND_TONE: Record<TopicUpdate["kind"], string> = {
  reports: "border-border text-fg-muted",
  facts: "border-accent/50 text-accent",
  official: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
};

function Sources({ links }: { links: UpdateLink[] }) {
  const seen = new Set<string>();
  const unique = links.filter((l) => (seen.has(l.publisher) ? false : (seen.add(l.publisher), true)));
  return (
    <span className="ml-1 text-xs">
      {unique.map((l) => (
        <OutboundLink key={l.articleId} articleId={l.articleId} className="mr-1.5 font-bold whitespace-nowrap text-accent hover:underline">
          {publisherLabel(l.publisher)} ↗
        </OutboundLink>
      ))}
    </span>
  );
}

function Body({ u, topicId }: { u: TopicUpdate; topicId: number }) {
  if (u.kind === "reports") {
    return (
      <>
        {u.newOutlets.length > 0 && (
          <p className="text-sm">
            {u.newOutlets.map(publisherLabel).join("・")}が新たに報道（{u.newOutlets.length}社）
          </p>
        )}
        <p className="mt-0.5 text-sm text-fg-muted">
          最新の見出し：
          <OutboundLink articleId={u.headline.articleId} className="font-bold text-fg hover:text-accent hover:underline">
            {u.headline.title}
          </OutboundLink>
          <span className="ml-1 text-xs">（{publisherLabel(u.headline.publisher)}）</span>
        </p>
      </>
    );
  }
  if (u.kind === "official") {
    return (
      <p className="text-sm">
        <span className="font-bold">{publisherLabel(u.publisher)}</span>
        {u.government ? "（官公庁）" : ""}：
        <OutboundLink articleId={u.articleId} className="hover:text-accent hover:underline">
          {u.title}
        </OutboundLink>
      </p>
    );
  }
  return (
    <div className="text-sm">
      {u.facts.length > 0 && (
        <ul className="space-y-0.5">
          {u.facts.map((f, i) => (
            <li key={i}>
              {f.text}
              <Sources links={f.links} />
            </li>
          ))}
        </ul>
      )}
      {u.now && (
        <p className="mt-0.5 text-fg-muted">
          <span className="font-bold text-fg">現在の状況：</span>
          {u.now.text}
          <Sources links={u.now.links} />
        </p>
      )}
      {u.topicId !== topicId && (
        <Link href={`/topic/${u.topicId}`} prefetch={false} className="mt-0.5 inline-block text-xs font-bold text-accent hover:underline">
          この続報のページ →
        </Link>
      )}
    </div>
  );
}

/**
 * ニュースのその後（話題ページの「何が変わったか」）。第一報・公式発表との時間の差・その後の動きを新しい順に並べる。
 * 動きがない話題では何も出さない
 */
export function TopicUpdates({
  topicId,
  first,
  lag,
  updates,
}: {
  topicId: number;
  first: { publisher: string; at: Date } | null;
  lag: { publisher: string; minutes: number; before: boolean } | null;
  updates: TopicUpdate[];
}) {
  if (updates.length === 0 && !lag) return null;
  return (
    <section id={CONTAINER} aria-labelledby="updates-heading" className="mb-6">
      <h2 id="updates-heading" className="mb-1 text-lg font-black">
        その後の動き
      </h2>
      <p className="mb-3 text-xs text-fg-subtle">
        {first && (
          <>
            第一報 {formatDateTime(first.at)}（{publisherLabel(first.publisher)}）
          </>
        )}
        {lag && (
          <>
            {first && "・"}
            {lag.before
              ? `${publisherLabel(lag.publisher)}の発表より${elapsedLabel(lag.minutes).replace("+", "")}前に報道`
              : `${publisherLabel(lag.publisher)}の発表から${lag.minutes === 0 ? "同時" : elapsedLabel(lag.minutes).replace("+", "")}${lag.minutes === 0 ? "" : "後"}に最初の報道`}
          </>
        )}
      </p>
      <SinceRead topicId={topicId} containerId={CONTAINER} times={updates.map((u) => u.at.toISOString())} />
      {updates.length > 0 && (
        <ol className="relative space-y-3 border-l-2 border-border pl-4">
          {updates.map((u) => (
            <li
              key={`${u.kind}-${u.at.toISOString()}-${u.kind === "official" ? u.articleId : u.kind === "reports" ? u.day : u.topicId}`}
              data-update-at={u.at.toISOString()}
              className="group relative data-[new=true]:rounded-lg data-[new=true]:bg-accent-soft/40 data-[new=true]:p-2"
            >
              <span aria-hidden className="absolute top-1.5 -left-[23px] h-2.5 w-2.5 rounded-full border-2 border-surface bg-border group-data-[new=true]:bg-accent" />
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                <time dateTime={u.at.toISOString()}>{formatDateTime(u.at)}</time>
                <span className={`rounded border px-1 font-bold ${KIND_TONE[u.kind]}`}>{KIND_LABEL[u.kind]}</span>
                <span className="hidden font-bold text-accent group-data-[new=true]:inline">前回より後</span>
              </p>
              <div className="mt-0.5">
                <Body u={u} topicId={topicId} />
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-fg-subtle">
        「新たな報道」「公式の発表」は収集した記録から、「続報で分かったこと」は各社の記事と照合した内容から作っています。出典のリンクから元の記事を確認できます。
      </p>
    </section>
  );
}
