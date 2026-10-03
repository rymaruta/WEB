import Link from "next/link";
import { BREAKING_RULES, breakingPostText, draftHeadline, listBreakingCandidates, MANUAL_BREAKING_HOURS } from "@/lib/digest/breaking";
import { jstTime } from "@/lib/digest/slots";
import { RISK_LABELS } from "@/lib/stories/schema";
import { publishBreakingAction, requestAiBreakingAction } from "../../actions";
import { AiRequestForm } from "./ai-request-form";
import { BreakingForm } from "./breaking-form";

export const dynamic = "force-dynamic";

/** 自動の速報で出さない分野（人が出すときは、印を見て判断する） */
const CAUTION = new Set<string>(BREAKING_RULES.excludedRisks);

export default async function BreakingPage() {
  const now = new Date();
  const { stories, postedToday } = await listBreakingCandidates(now);

  return (
    <div className="space-y-4">
      <header>
        <Link href="/admin" className="text-sm text-fg-muted hover:text-fg">
          ← 配信一覧
        </Link>
        <h1 className="mt-1 text-xl font-extrabold">速報を作る</h1>
        <p className="mt-1 text-sm text-fg-muted">
          直近{MANUAL_BREAKING_HOURS}時間に最初に報じられた、まだ配信していない出来事です（報じた媒体の多い順。AI 解析前の出来事も出します）。投稿文とカードの「◯時◯分時点」は、投稿した時刻になります。見出しは投稿の前に直せます。
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          今日の速報 {postedToday} 本（自動の速報は1日{BREAKING_RULES.maxPerDay}本まで。ここで出した分も数えます）
        </p>
      </header>

      {stories.length === 0 && <p className="card p-4 text-sm text-fg-muted">いま速報の候補になる出来事はありません。</p>}

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
                <pre className="mt-2 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap">{breakingPostText(headline, now).join("\n")}</pre>
              </details>
              <div className="mt-3">
                <BreakingForm action={publishBreakingAction.bind(null, s.id)} headline={headline} previewSrc={`/api/admin/breaking/${s.id}/card`} />
                <div className="mt-2">
                  <AiRequestForm action={requestAiBreakingAction.bind(null, s.id)} />
                </div>
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
