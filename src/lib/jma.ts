/**
 * 気象庁の防災情報 XML（地震・津波・火山）。報道より早く、確かな一次情報として話題に加える。
 * 気象庁の「高頻度フィード」（Atom。https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml）から、
 * 大きな出来事だけを選んで詳しい XML を読み、見出しと要約を作る（出典：気象庁。政府標準利用規約に沿って出典を明記する）。
 * - 地震：震源・震度に関する情報（VXSE53）のうち、最大震度 JMA.minIntensity 以上
 * - 津波：津波警報・注意報・予報（VTSE41）のうち、警報・注意報を含むもの（予報だけのものは除く）
 * - 火山：噴火速報（VFVO56）と、噴火警報（VFVO50 のうち「噴火警報」を含むもの）
 * DB に依存しない（取得は呼び出し側から渡せる）
 */

export const JMA = {
  feedUrl: "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml",
  /** この震度以上の地震を話題にする（震度4：多くの人が揺れに気づき、報道も出る） */
  minIntensity: 4,
  /** 一覧の項目のうち、詳しい XML を読む上限（1回の取得で） */
  maxDetails: 12,
  /** 読者が開く気象庁のページ（XML ではなく、地図で見られるページ） */
  pages: {
    earthquake: "https://www.jma.go.jp/bosai/map.html#contents=earthquake_map",
    tsunami: "https://www.jma.go.jp/bosai/map.html#contents=tsunami",
    volcano: "https://www.jma.go.jp/bosai/map.html#contents=volcano",
  },
} as const;

export type JmaKind = keyof typeof JMA.pages;

export type JmaEntry = { title: string; updated: Date; url: string };

export type JmaItem = {
  kind: JmaKind;
  /** 記事の URL（一意。気象庁の地図のページに、元の電文の ID を付ける） */
  url: string;
  title: string;
  summary: string;
  publishedAt: Date;
  /** 地震の最大震度（数値。5弱は 5、5強は 5.5 など）。地震以外は null */
  intensity: number | null;
};

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : null;
};

/** 高頻度フィード（Atom）の項目 */
export function parseJmaFeed(atom: string): JmaEntry[] {
  return [...atom.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((m) => {
    const e = m[1];
    const title = tag(e, "title");
    const updated = tag(e, "updated");
    const url = e.match(/<link[^>]*href="([^"]+)"/)?.[1];
    if (!title || !updated || !url) return [];
    return [{ title, updated: new Date(updated), url }];
  });
}

/** 詳しく読む電文か（一覧の題名で判断する） */
export function wantedEntry(title: string): boolean {
  return title === "震源・震度に関する情報" || title.startsWith("津波警報・注意報・予報") || title === "噴火速報" || title === "噴火警報・予報";
}

/** 震度の表記（"5-" "5+" など）を数値に（並べ替え・比較用） */
export function intensityValue(code: string | null): number | null {
  if (!code) return null;
  const m = code.match(/^([1-7])([+-])?$/);
  if (!m) return null;
  return Number(m[1]) + (m[2] === "+" ? 0.5 : 0);
}

/** 震度の読み方（"5-" → "5弱"） */
export function intensityLabel(code: string): string {
  return code.replace("-", "弱").replace("+", "強");
}

/** 電文の ID（URL の末尾。記事の URL を一意にするため） */
const messageId = (url: string) => url.split("/").pop()?.replace(/\.xml$/, "") ?? url;

const oneLine = (s: string) => s.replace(/[\s　]+/g, " ").trim();

/**
 * 電文（詳しい XML）から記事を作る。話題にしないもの（震度が小さい・予報だけ・取消）は null。
 * @param url 電文の URL（記事の URL を一意にするために使う）
 */
export function buildJmaItem(detail: string, url: string): JmaItem | null {
  const head = tag(detail, "Head") ?? "";
  // 電文の種類は Control の題名で見る（Head の題名は「震源・震度情報」のように短い）
  const title = tag(tag(detail, "Control") ?? "", "Title") ?? tag(head, "Title") ?? "";
  const infoType = tag(head, "InfoType");
  if (infoType === "取消") return null;
  const reported = tag(head, "ReportDateTime");
  const publishedAt = reported ? new Date(reported) : null;
  if (!publishedAt || Number.isNaN(publishedAt.getTime())) return null;
  const headline = oneLine(tag(tag(head, "Headline") ?? "", "Text") ?? "");
  const id = messageId(url);

  if (title === "震源・震度に関する情報") {
    const body = tag(detail, "Body") ?? "";
    const observation = tag(body, "Observation") ?? "";
    const maxCode = tag(observation, "MaxInt");
    const intensity = intensityValue(maxCode);
    if (intensity === null || intensity < JMA.minIntensity) return null;
    const area = tag(tag(tag(body, "Hypocenter") ?? "", "Area") ?? "", "Name");
    const magnitude = body.match(/<jmx_eb:Magnitude[^>]*>([^<]+)</)?.[1];
    const mag = magnitude && /^\d/.test(magnitude) ? `M${magnitude}` : null;
    const tsunami = oneLine(tag(tag(tag(body, "Comments") ?? "", "ForecastComment") ?? "", "Text") ?? "");
    const prefs = [...observation.matchAll(/<Pref>\s*<Name>([^<]+)<\/Name>\s*<Code>\d+<\/Code>\s*<MaxInt>([^<]+)<\/MaxInt>/g)]
      .map((p) => ({ name: p[1], value: intensityValue(p[2]) ?? 0, label: intensityLabel(p[2]) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const where = area ? `${area}で` : "";
    const head1 = `${where}最大震度${intensityLabel(maxCode!)}の地震${mag ? `（${mag}）` : ""}`;
    const summary = [headline, prefs.length ? `各地の最大震度：${prefs.map((p) => `${p.name} ${p.label}`).join("、")}。` : "", tsunami].filter(Boolean).join(" ");
    return { kind: "earthquake", url: `${JMA.pages.earthquake}&id=${id}`, title: `${head1}${tsunami.includes("心配はありません") ? "　津波の心配なし" : ""}`, summary, publishedAt, intensity };
  }

  if (title.startsWith("津波警報・注意報・予報")) {
    // 予報（若干の海面変動）だけのものは話題にしない
    if (!/津波警報|津波注意報/.test(headline) && !/大津波警報|津波警報|津波注意報/.test(tag(detail, "Body") ?? "")) return null;
    const kindName = /大津波警報/.test(headline) ? "大津波警報" : /津波警報/.test(headline) ? "津波警報" : /津波注意報/.test(headline) ? "津波注意報" : null;
    if (!kindName) return null;
    const lifted = /解除/.test(headline);
    return { kind: "tsunami", url: `${JMA.pages.tsunami}&id=${id}`, title: lifted ? `${kindName}を解除` : `${kindName}を発表`, summary: headline, publishedAt, intensity: null };
  }

  if (title === "噴火速報" || (title === "噴火警報・予報" && /噴火警報/.test(headline))) {
    const volcano = tag(tag(tag(tag(detail, "Body") ?? "", "VolcanoInfo") ?? "", "Area") ?? "", "Name");
    const name = volcano ?? headline.match(/【?([^\s【】]+?)(?:で|に)/)?.[1] ?? "";
    return { kind: "volcano", url: `${JMA.pages.volcano}&id=${id}`, title: `${name ? `${name}に` : ""}${title === "噴火速報" ? "噴火速報" : "噴火警報"}`, summary: headline, publishedAt, intensity: null };
  }
  return null;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** 高頻度フィードを読み、話題にする電文を記事にする（新しい順） */
export async function fetchJmaItems(fetchImpl: Fetch = fetch, ua = "ZenbuNavi/1.0 (+https://zenbu-navi.com/about)"): Promise<JmaItem[]> {
  const get = async (url: string) => {
    const res = await fetchImpl(url, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) throw new Error(`jma ${res.status}`);
    return new TextDecoder("utf-8").decode(await res.arrayBuffer());
  };
  const entries = parseJmaFeed(await get(JMA.feedUrl)).filter((e) => wantedEntry(e.title)).slice(0, JMA.maxDetails);
  const items: JmaItem[] = [];
  for (const e of entries) {
    try {
      const item = buildJmaItem(await get(e.url), e.url);
      if (item) items.push(item);
    } catch {
      // 1件の電文が読めなくても、ほかは続ける
    }
  }
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
