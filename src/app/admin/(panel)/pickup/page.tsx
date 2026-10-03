import Link from "next/link";
import { BREAKING_RULES, draftHeadline, listPickupCandidates, PICKUP_HOURS, pickupPostText } from "@/lib/digest/breaking";
import { jstTime } from "@/lib/digest/slots";
import { RISK_LABELS } from "@/lib/stories/schema";
import { publishPickupAction } from "../../actions";
import { BreakingForm } from "../breaking/breaking-form";

export const dynamic = "force-dynamic";

/** 人が確かめてから出すべき分野（速報で自動では出さない分野と同じ） */
const CAUTION = new Set<string>(BREAKING_RULES.excludedRisks);

/**
 * 注目のニュース（速報の表示なし）。速報ほど急ぎではないが、多くの媒体が報じた出来事を、
 * 速報と同じ形の1枚のカードで X に出す。自動では出さず、ここで人が選んで投稿する
 */
export default async function PickupPage() {
  const now = new Date();
  const { stories, postedToday } = await listPickupCandidates(now);

  return (
    <div className="space-y-4">
      <header>
        <Link href="/admin" className="text-sm text-fg-muted hover:text-fg">
          ← 配信一覧
        </Link>
        <h1 className="mt-1 text-xl font-extrabold">注目のニュースを出す</h1>
        <p className="mt-1 text-sm text-fg-muted">
          直近{PICKUP_HOURS}時間に最初に報じられ、速報・注目のニュースとしてまだ出していない出来事です（報じた媒体の多い順）。速報と同じ形のカードで、「速報」の表示をせずに投稿します。自動では投稿しません。
        </p>
        <p className="mt-1 text-sm text-fg-muted">今日の注目のニュース {postedToday} 本（速報の本数には数えません）</p>
      </header>

      {stories.length === 0 && <p className="card p-4 text-sm text-fg-muted">いま候補になる出来事はありません。</p>}

      <ul className="space-y-3">
        {stories.map((s) => {
          const cautions = s.riskFlags.filter((f) => CAUTION.has(f));
          // 解析待ちの出来事は見出しがまだないため、話題の見出しを下書きとして出す（12字×2行に直してから投稿する）
          const queued = s.status === "QUEUED";
          const headline = queued ? draftHeadline(s.topic) : s.headline;
          return (
            <li key={s.id} className="card p-4">
              <p className="font-bold leading-snug">{headline.join("")}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fg-muted">
                <span>{s.topic.publisherCount}媒体</span>
                <span>最初の報道 {jstTime(s.topic.firstSeenAt)}</span>
                {queued && <span className="font-bold text-accent">AI 解析前（見出しを12字×2行に直し、内容を記事で確かめてから投稿）</span>}
                {s.status === "REVIEW_REQUIRED" && <span className="font-bold text-accent">要確認</span>}
                {s.confidence !== null && s.confidence < BREAKING_RULES.minConfidence && <span className="font-bold text-accent">照合の確からしさが低い</span>}
                {cautions.length > 0 && <span className="font-bold text-accent">注意：{cautions.map((f) => RISK_LABELS[f as keyof typeof RISK_LABELS] ?? f).join("・")}</span>}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-bold text-accent">投稿文（直す前の見出し）</summary>
                <pre className="mt-2 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap">{pickupPostText(headline).join("\n")}</pre>
              </details>
              <div className="mt-3">
                <BreakingForm action={publishPickupAction.bind(null, s.id)} headline={headline} kind="注目のニュース" previewSrc={`/api/admin/breaking/${s.id}/card?kind=pickup`} />
                <Link href={`/topic/${s.topic.id}`} target="_blank" className="mt-2 inline-block text-sm text-fg-muted underline">
                  記事を確かめる ↗
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
