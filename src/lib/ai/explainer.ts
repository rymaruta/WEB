import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { META_SENTENCE } from "@/lib/ai/article";
import { BANNED_WORDS, extractFacts, extractNames, factInSources, longestCommonRun } from "@/lib/stories/verify";

/**
 * 「◯◯とは」（ぜんぶナビ編集部が調べた解説）。
 * まとめ記事は各社の報道を束ねたもので、報道に書かれていない「そもそも何の話か」（作品・企業・制度・大会などの基本）が分からないことがある。
 * 例：「東京リベンジャーズ 三天戦争編 放送開始」の報道は放送日時だけで、三天戦争編がどんな話かが書かれていない。
 * 執筆者（Claude Code の定期実行）が公式サイトなどを自分で調べて書き、このサイトは次を機械的に確かめてから載せる:
 * - 出典のページをこのサイトが自分で取得し、執筆者が示した抜き書き（quote）がそのページに実際にあるか（作り話の出典を載せない）
 * - 解説の文の数字・カギかっこの語・英数字・人名が、その文の出典の抜き書きにあるか（出典で確かめられないことを書かない）
 * - 出典の文章をそのまま長く写していないか（著作権。抜き書きは照合にだけ使い、画面には出さない）
 */

/** 解説の文の数と出典の数の上限 */
export const EXPLAINER_MAX_ITEMS = 5;
export const EXPLAINER_MAX_REFS = 6;
/** 抜き書きの長さ（短すぎると照合にならず、長すぎると引き写しになる） */
const QUOTE_MIN = 8;
const QUOTE_MAX = 200;
/** 解説の文が出典の文章と、この文字数以上続けて同じなら引き写しとみなす */
const COPY_RUN = 30;
/** 出典のページを取りに行くときの上限 */
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;

export const ExplainerSchema = z.object({
  subject: z
    .string()
    .min(2)
    .max(30)
    .describe("何についての解説か。見出しに「◯◯とは」と出す。例: 「三天戦争編」「データセンター建設の一時停止」"),
  items: z
    .array(
      z.object({
        text: z.string().min(10).max(160).describe("解説の1文（その話題を知らない人向け。出典に書かれていることだけを自分の言葉で）"),
        refs: z.array(z.number().int()).min(1).describe("この文の根拠になる出典の番号（refs の1始まり）"),
      }),
    )
    .min(2)
    .max(EXPLAINER_MAX_ITEMS)
    .describe("解説の文を2〜5個。基本（何か・誰か）→ 経緯 → 今回の出来事の位置づけ、の順"),
  refs: z
    .array(
      z.object({
        url: z.string().url().describe("実際に開いて読んだページの URL（https）。公式サイト・企業や官公庁の発表を優先する"),
        title: z.string().min(2).max(80).describe("ページの題名（サイト名を含めてよい）"),
        quote: z
          .string()
          .min(QUOTE_MIN)
          .max(QUOTE_MAX)
          .describe(`ページ本文からの抜き書き（${QUOTE_MIN}〜${QUOTE_MAX}字）。そのページに書かれている文字列をそのまま。解説の文の根拠になる部分を選ぶ。画面には出さず、照合にだけ使う`),
      }),
    )
    .min(1)
    .max(EXPLAINER_MAX_REFS),
});

export type Explainer = z.infer<typeof ExplainerSchema>;

/** 保存・表示する形（抜き書きは照合に使ったもの。画面には出さない） */
export type StoredExplainer = {
  subject: string;
  items: { text: string; refs: number[] }[];
  refs: { url: string; title: string; host: string; quote: string }[];
};

export const EXPLAINER_INSTRUCTIONS = `あなたはニュースサイト「ぜんぶナビ」の編集者です。まとめ記事（各社の報道の要約）だけでは、その話題を知らない人が「そもそも何の話か」をつかめないことがあります。そこを自分で調べて、短い解説（「◯◯とは」）を書きます。

例：「東京リベンジャーズ 三天戦争編 放送開始」の記事は放送日時しか書かれていない。読者が知りたいのは「三天戦争編とはどんな話か（シリーズの何作目で、どんな勢力の争いか）」。

手順:
1. 記事の見出し・リード・要点を読み、知らない人がいちばん分からない語・事柄を1つ決める（subject）。作品・シリーズの章、企業・団体、制度・法律、大会、技術、人物の経歴など。記事を読めば分かることの言い換えは不要。
2. WebSearch / WebFetch で調べる。公式サイト・作品の公式ページ・企業や官公庁の発表・一次資料を優先する。報道しか見つからなければ報道でよい（どの媒体かが出典に残る）。Wikipedia などの百科事典は、そこに書かれた一次資料を開いてそちらを出典にする。
3. 解説の文（items）を2〜5個書く。1文目は必ず subject そのものの定義（subject の語を文に入れ、「それが何か」を書く）。そのあと「経緯 → 今回の出来事の位置づけ」。1文160字以内。
   例：subject が「三天戦争編」なら、1文目は「三天戦争」そのもの（どのチーム同士の、何をめぐる争いか）。原作者・放送局などの周辺情報だけで終わらせない。

厳守すること:
- 開いて読んだページに書かれていることだけを書く。記憶や推測で補わない。ページによって内容が違うときは書かない。
- 各文の refs には根拠のページの番号を入れ、そのページの quote（抜き書き）には、その文の数字・固有名詞が入っている部分を、ページの本文の文字列そのままで入れる。このサイトがページを取得して抜き書きがあるか確かめ、なければ載せない。1つのページから別々の部分を抜き書きするときは、同じ URL を refs に複数回入れてよい。
- 記事の見出し・リード・要点に出てくる語（作品名など）は、抜き書きに入っていなくてよい。
- 固有名詞（作品名・チーム名・制度名など）はカギかっこ「」で囲む。カギかっこの語・数字・英字・人名は抜き書きと照合される。
- ページの文章を長く写さず、自分の言葉で短く書く（30字以上続けて同じだと載せない）。とくに定義の1文目は、抜き書きの語順をなぞらず、主語・語順を変えて言い換える。
- 作品の結末・試合の結果など、まだ放送・公開されていない先の展開（ネタバレ）は書かない。公式のあらすじの範囲にとどめる。
- 事件・事故・訃報、個人の私生活、政治的に意見が分かれる評価は扱わない（その場合は explainer を null にする）。
- 調べても確かな出典が見つからない、または解説が要らない話題は explainer を null にし、reason に理由を1文で書く（無理に書かない）。製品・技術・制度・企業・作品の話題は、たいてい公式の説明ページがあるので、まず探す。
- 「資料には」「記事では」など、作り方についての文は書かない。`;

/** 調べ直しを避けるため、見送った話題は記録する。書けなかった理由（記録用） */
export type ExplainerCheck = { explainer: StoredExplainer | null; problems: string[] };

/** 抜き書きとページ本文を比べるための正規化（全角・半角、空白、引用符の違いを無視する） */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .replace(/[“”"「」『』'’‘]/g, "")
    .toLowerCase();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  middot: "・",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  laquo: "«",
  raquo: "»",
  yen: "¥",
  copy: "©",
};

/** HTML から本文の文字列を取り出す（スクリプト・スタイルを除き、タグを空白にする） */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** 文字コードを決める（応答のヘッダー → HTML の meta の順。分からなければ UTF-8） */
export function detectCharset(contentType: string | null, head: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const ascii = new TextDecoder("latin1").decode(head.slice(0, 4096));
  const fromMeta = ascii.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return (fromMeta ?? "utf-8").toLowerCase();
}

/** 内部のアドレス（このサーバー自身・社内網）へは取りに行かない */
function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** 出典にしてよい URL か（https・公開のホスト名だけ） */
export function isAllowedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (isIP(host) || host === "localhost" || !host.includes(".") || /\.(local|internal|localhost)$/.test(host)) return false;
  return true;
}

/** 出典のページを取得して本文の文字列を返す。取れなければ null */
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    // 転送先も1つずつ確かめる（転送で内部のアドレスへ向けられないように）
    let current = url;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedUrl(current)) return null;
      const { address } = await lookup(new URL(current).hostname);
      if (isPrivateAddress(address)) return null;
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; ZenbuNaviBot/1.0; +https://zenbu-navi.com/about)", accept: "text/html,text/plain;q=0.9" },
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) break;
      current = new URL(location, current).toString();
      res = null;
    }
    if (!res || !res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) return null;
    const buf = new Uint8Array(await res.arrayBuffer()).slice(0, FETCH_MAX_BYTES);
    let decoded: string;
    try {
      decoded = new TextDecoder(detectCharset(type, buf)).decode(buf);
    } catch {
      decoded = new TextDecoder("utf-8").decode(buf);
    }
    return /html/i.test(type) || /<html|<body|<p[\s>]/i.test(decoded.slice(0, 5000)) ? htmlToText(decoded) : decoded;
  } catch {
    return null;
  }
}

/**
 * 解説を検証する（ページの取得は pages として外から渡す。DB・ネットワークに依存しない）。
 * - 抜き書きがページ本文にない出典は使わない。使えない出典だけを根拠にした文は落とす
 * - 文の数字・カギかっこの語・英数字・人名が、その文の出典の抜き書きにないものは落とす
 * - 煽り表現・作り方についての文・出典の引き写しは落とす
 * - 文が2つ未満しか残らなければ載せない
 * @param pages 出典の番号（0始まり）ごとのページ本文。取得できなかったものは null
 * @param article この話題のまとめ記事の見出し・リード・要点（報道との照合を通ったもの）。ここにある語（作品名など）は抜き書きになくてよい
 */
export function checkExplainer(e: Explainer, pages: (string | null)[], article = ""): ExplainerCheck {
  const problems: string[] = [];
  const okRef = e.refs.map((r, i) => {
    if (!isAllowedUrl(r.url)) {
      problems.push(`出典${i + 1}: URL が使えない`);
      return false;
    }
    const page = pages[i];
    if (!page) {
      problems.push(`出典${i + 1}: ページを取得できない`);
      return false;
    }
    if (!normalizeForMatch(page).includes(normalizeForMatch(r.quote))) {
      problems.push(`出典${i + 1}: 抜き書きがページにない`);
      return false;
    }
    return true;
  });

  const kept: { text: string; refs: number[] }[] = [];
  for (const item of e.items) {
    const text = item.text.trim();
    const refs = [...new Set(item.refs)].filter((n) => n >= 1 && n <= e.refs.length && okRef[n - 1]).sort((a, b) => a - b);
    if (refs.length === 0) {
      problems.push(`「${text.slice(0, 20)}」: 確かめられる出典がない`);
      continue;
    }
    const corpus = [...refs.map((n) => e.refs[n - 1].quote), article].join("\n");
    const missing = [...extractFacts(text), ...extractNames(text)].filter((f) => !factInSources(f, corpus));
    if (missing.length) {
      problems.push(`「${text.slice(0, 20)}」: 出典の抜き書きにない語 ${missing.join("・")}`);
      continue;
    }
    if (BANNED_WORDS.some((w) => text.includes(w)) || META_SENTENCE.test(text) || /記事では|この記事/.test(text)) {
      problems.push(`「${text.slice(0, 20)}」: 読者向けでない表現`);
      continue;
    }
    if (refs.some((n) => longestCommonRun(normalizeForMatch(text), normalizeForMatch(e.refs[n - 1].quote)) >= COPY_RUN)) {
      problems.push(`「${text.slice(0, 20)}」: 出典の文章をそのまま写している`);
      continue;
    }
    kept.push({ text, refs });
  }
  if (kept.length < 2) return { explainer: null, problems: [...problems, "確かめられた文が2つ未満"] };
  // 「◯◯とは」の見出しに対して、◯◯そのものを説明した文がなければ載せない（周辺情報だけの解説にしない）。定義の文を先頭にする
  const subject = normalizeForMatch(e.subject);
  const defining = kept.findIndex((k) => normalizeForMatch(k.text).includes(subject));
  if (defining < 0) return { explainer: null, problems: [...problems, `「${e.subject}」そのものを説明した文がない`] };
  kept.unshift(...kept.splice(defining, 1));

  // 使った出典だけを残し、番号を振り直す。同じページ（URL）からの複数の抜き書きは、出典欄では1つにまとめる
  const used = [...new Set(kept.flatMap((k) => k.refs))].sort((a, b) => a - b);
  const urls = [...new Set(used.map((n) => e.refs[n - 1].url))];
  const renumber = new Map(used.map((n) => [n, urls.indexOf(e.refs[n - 1].url) + 1]));
  return {
    explainer: {
      subject: e.subject.trim(),
      items: kept.map((k) => ({ text: k.text, refs: [...new Set(k.refs.map((n) => renumber.get(n)!))].sort((a, b) => a - b) })),
      refs: urls.map((url) => {
        const same = used.filter((n) => e.refs[n - 1].url === url).map((n) => e.refs[n - 1]);
        return { url, title: same[0].title.trim(), host: new URL(url).hostname.replace(/^www\./, ""), quote: same.map((r) => r.quote).join(" / ") };
      }),
    },
    problems,
  };
}

const StoredSchema = z.object({
  subject: z.string(),
  items: z.array(z.object({ text: z.string(), refs: z.array(z.number().int()) })),
  refs: z.array(z.object({ url: z.string(), title: z.string(), host: z.string(), quote: z.string() })),
});

/** 保存された解説を表示用に取り出す（不正なら null） */
export function readExplainer(raw: unknown): StoredExplainer | null {
  const parsed = StoredSchema.safeParse(raw);
  return parsed.success && parsed.data.items.length > 0 ? parsed.data : null;
}
