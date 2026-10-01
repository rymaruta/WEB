import { formatDateTime } from "@/lib/format";
import type { PreviousCoverage, StoryMaterial } from "./schema";

const COMMON_RULES = `- 資料に書かれている事実だけを使う。資料にない数字・人名・日時・原因・背景知識・用語の説明を加えない。推測や意見を書かない。
- 誇張や煽りの言葉（衝撃、ヤバい、必見、まさか、炎上 など）と感嘆符を使わない。ハッシュタグを付けない。
- 政治・国際の話題は中立に書く。評価する言葉を使わず、主張には主語を付ける（「〇〇党は〜と主張」）。
- 災害・事件・事故・訃報は、落ち着いた言葉で事実だけを書く。
- 資料の文をそのまま長く写さない。短く言い直す。
- その話題を知らない人が読んでも意味がわかる言葉で書く。作品の中や業界の中でしか通じない言葉・略語（例:「10章（下）を実装」「同接」「ナーフ」「コラボ復刻」）は、資料に書かれた範囲で一般的な言葉に言い換える（例:「ストーリーの新しい章を追加」「同時接続プレイヤー数」）。言い換えても意味が伝わらない要点は書かず、別の事実を選ぶ。
- 文字数の上限を必ず守る。全角を1字、半角英数字を0.5字として数える。`;

/** ストーリー解析の指示文。資料以外の知識で補わせない */
export const STORY_SYSTEM = `あなたはニュース編集者です。同じ出来事を報じた複数の資料（各媒体の見出しと短い要約、公式発表）だけを根拠に、1日3回の定時ニュースダイジェスト（X のカード）に載せるためのデータを作ります。読者は通勤中に片手で読む会社員です。

厳守すること:
${COMMON_RULES}
- 媒体間で食い違う事実は conflicts に入れ、見出しと要点では断定しない。
- 確かめられない項目は「不明」とする。資料が足りない、または同じ出来事とは言えない場合は sufficient を false にする。
- 見出し: 1〜2行、各行12字以内。要点: 2〜3個、各16字以内。一覧用の見出し: 14字以内。キーワード: 8字以内。
- why（なぜ重要か）は、資料に重要性や影響を示す記述があるときだけ書く（26字以内）。なければ null にする。資料にない一般論や推測で埋めない。
- assessment は控えめに付ける。話題になっていることと、重要であることを区別する。
- 各要点と why の sources に、根拠の資料番号をすべて入れる。`;

/** 続報の差分の指示文 */
export const FOLLOWUP_SYSTEM = `あなたはニュース編集者です。前回の配信で伝えた出来事について、その後に届いた資料だけを根拠に「結局どうなったか」を伝える続報カードのデータを作ります。

厳守すること:
${COMMON_RULES}
- newFacts には、前回の配信に含まれていない新しい事実（決定・発表・数字の更新など）だけを入れる。言い換えや、前回と同じ事実の繰り返しは入れない。新しい事実がなければ空配列にする。
- before は前回の配信の内容だけを使って書く。now と newFacts は新しい資料だけを根拠にする。
- 各行の上限: before・now・newFacts は24字以内、一覧用の見出しは14字以内。
- now と newFacts の sources に、根拠の資料番号をすべて入れる。`;

function materialLines(materials: StoryMaterial[]): string {
  return materials
    .map((m) => {
      const label = m.isPrimary ? "（公式発表）" : "";
      return `[${m.position}] ${m.publisher}${label}／${formatDateTime(m.publishedAt)}\n見出し: ${m.title}\n要約: ${m.summary ?? "（なし）"}`;
    })
    .join("\n\n");
}

export function buildStoryPrompt(materials: StoryMaterial[]): string {
  return `次の資料から、ニュースカード用のデータを作ってください。\n\n${materialLines(materials)}`;
}

export function buildFollowupPrompt(previous: PreviousCoverage, materials: StoryMaterial[]): string {
  const prev = [
    `キーワード: ${previous.keyword}`,
    `見出し: ${previous.headline.join(" ")}`,
    `要約: ${previous.summary}`,
    ...previous.points.map((p) => `要点: ${p}`),
    `配信: ${formatDateTime(previous.publishedAt)}`,
  ].join("\n");
  return `■ 前回の配信の内容\n${prev}\n\n■ その後に届いた資料\n${materialLines(materials)}\n\n前回から何が変わったかを、続報カード用のデータにしてください。`;
}
