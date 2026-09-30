const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  times: "×",
  yen: "¥",
  copy: "©",
  reg: "®",
  trade: "™",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

export function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]*>/g, " ");
}

function collapseWhitespace(s: string): string {
  return s.replace(/[\s　]+/g, " ").trim();
}

/** XML/HTML 由来の文字列を、表示用のプレーンテキストに変換する */
export function toPlainText(raw: string): string {
  return collapseWhitespace(decodeEntities(stripTags(decodeEntities(raw))));
}

const BOILERPLATE = [
  /\[(画像|動画|表)\s*\d*\s*:\s*https?:\/\/[^\]\s]*\]?\s*/g,
  /^ざっくり言うと\s*/,
  /\s*(記事を読む|続きを読む|続きをみる|もっと見る|Read more|\[?…\]?\s*$)\s*$/i,
  /\s*The post .* appeared first on .*$/i,
];

export function toSummary(raw: string | undefined, maxLength = 120): string | null {
  if (!raw) return null;
  let text = toPlainText(raw);
  for (const re of BOILERPLATE) text = text.replace(re, "");
  text = text.trim();
  if (!text) return null;
  const chars = Array.from(text);
  return chars.length > maxLength ? chars.slice(0, maxLength).join("").trimEnd() + "…" : text;
}

/** 媒体名ではないが、見出し末尾に付く定型語 */
const GENERIC_SUFFIXES = new Set(["記事", "ニュース", "news"]);

/**
 * 見出しを整える。
 * - 先頭の「[ITmedia News] 」のような配信元表記を取り除く
 * - 末尾の「 - 媒体名」「｜媒体名」を、媒体名（または定型語）と一致する場合に限り取り除く
 */
export function cleanTitle(raw: string, publisherNames: string[] = []): string {
  const title = toPlainText(raw).replace(/^\[[^\]]{1,40}\]\s*/, "");
  const m = title.match(/^(.*\S)\s*[|｜\-–—:：]\s*([^|｜\-–—]{1,40})$/);
  if (m) {
    const tail = m[2].trim().toLowerCase();
    if (GENERIC_SUFFIXES.has(tail) || publisherNames.some((p) => p && tail.includes(p.toLowerCase()))) {
      return m[1].trim();
    }
  }
  return title;
}

/**
 * ソーシャルブックマーク経由の見出し（リンク先ページの <title>）から末尾のサイト名を分離する。
 * 「記事見出し - 日本経済新聞」→ { title: "記事見出し", site: "日本経済新聞" }
 * 区切りの前後に空白があるものだけを対象とし、見出し中の「-」を誤って切らないようにする。
 */
export function splitSiteSuffix(title: string): { title: string; site: string | null } {
  const m = title.match(/^(.{8,}?\S)\s+(?:-|\||｜|–|—)\s+([^|｜\-–—]{2,25})$/);
  if (!m) return { title, site: null };
  return { title: m[1].trim(), site: m[2].trim() };
}

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|yclid$|media$|ref$|cx_)/i;

/** 重複判定に使う正規化 URL。解析できない場合は null */
export function normalizeUrl(raw: string, base?: string): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** 表示用のドメイン名（www. を除去） */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
