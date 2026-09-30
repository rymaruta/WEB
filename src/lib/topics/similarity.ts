/**
 * 見出しの類似度計算。
 * 日本語は分かち書きせずに文字 bigram を特徴量とし、窓内の出現頻度から IDF で重み付けする。
 * 「した」「する」のような頻出 bigram の影響が小さくなり、固有名詞由来の bigram が効く。
 */

export type Vector = Map<string, number>;

const TEMPLATE_MIN_DF = 4;
const TEMPLATE_GROUP_SHARE = 0.8;

const NOISE_WORDS = [
  "速報",
  "独自",
  "詳報",
  "動画",
  "写真",
  "画像",
  "ニュース",
  "まとめ",
  "最新",
  "解説",
  "インタビュー",
];

export function normalizeForMatch(title: string): string {
  // 「[ITmedia News] 」のような先頭の配信元表記は話題の内容と無関係なので除く
  let s = title.normalize("NFKC").replace(/^\s*\[[^\]]{1,40}\]\s*/, "").toLowerCase();
  for (const w of NOISE_WORDS) s = s.split(w).join(" ");
  // 記号・空白を区切りとして扱い、比較対象は文字（かな・漢字・英数字）に限定する
  return s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function bigrams(title: string): string[] {
  const out: string[] = [];
  for (const chunk of normalizeForMatch(title).split(" ")) {
    const chars = Array.from(chunk);
    if (chars.length === 1) {
      // 1文字の英数字は情報量が少ないので捨て、漢字1文字（「株」「円」など）は残す
      if (/\p{Script=Han}/u.test(chars[0])) out.push(chars[0]);
      continue;
    }
    for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
  }
  return out;
}

export class IdfModel {
  private readonly df = new Map<string, number>();
  private readonly groupDf = new Map<string, Map<string, number>>();
  private docs = 0;

  /**
   * @param idfPower IDF の指数。1 より大きくすると固有名詞など希少な bigram をより重視する
   */
  constructor(
    docs: Iterable<string | { title: string; group?: string }>,
    private readonly idfPower = 1,
    private readonly minDf = 1,
  ) {
    for (const d of docs) {
      if (typeof d === "string") this.add(d);
      else this.add(d.title, d.group);
    }
  }

  /** @param group 掲載元など。定型句（同じ媒体ばかりが使う bigram）の判定に使う */
  add(title: string, group?: string) {
    this.docs++;
    for (const g of new Set(bigrams(title))) {
      this.df.set(g, (this.df.get(g) ?? 0) + 1);
      if (group !== undefined) {
        let counts = this.groupDf.get(g);
        if (!counts) this.groupDf.set(g, (counts = new Map()));
        counts.set(group, (counts.get(group) ?? 0) + 1);
      }
    }
  }

  /**
   * 同じ媒体の見出しに偏って現れる bigram（「試合記録」「難読漢字」などの連載・定型見出し）か。
   * これを特徴量に含めると、同じ媒体の無関係な記事同士が同一トピックに誤って束ねられる。
   */
  isTemplate(gram: string): boolean {
    const df = this.df.get(gram) ?? 0;
    if (df < TEMPLATE_MIN_DF) return false;
    const counts = this.groupDf.get(gram);
    if (!counts) return false;
    return Math.max(...counts.values()) / df >= TEMPLATE_GROUP_SHARE;
  }

  idf(gram: string): number {
    const base = Math.log((this.docs + 1) / ((this.df.get(gram) ?? 0) + 1)) + 1;
    return this.idfPower === 1 ? base : Math.pow(base, this.idfPower);
  }

  /**
   * @param minDf これ未満の文書にしか現れない bigram は無視する。
   *   窓内で1記事にしか出ない bigram は他記事と一致し得ず、ベクトルのノルムを膨らませて
   *   類似度を不当に下げるだけなので、既定で除外する。
   */
  vector(title: string, minDf = this.minDf): Vector {
    const tf = new Map<string, number>();
    for (const g of bigrams(title)) tf.set(g, (tf.get(g) ?? 0) + 1);
    const v: Vector = new Map();
    for (const [g, n] of tf) {
      if ((this.df.get(g) ?? 0) < minDf || this.isTemplate(g)) continue;
      v.set(g, n * this.idf(g));
    }
    return normalize(v);
  }
}

export function normalize(v: Vector): Vector {
  let norm = 0;
  for (const x of v.values()) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  const out: Vector = new Map();
  for (const [k, x] of v) out.set(k, x / norm);
  return out;
}

/** 両ベクトルに共通する特徴量の数 */
export function sharedCount(a: Vector, b: Vector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  for (const k of small.keys()) if (large.has(k)) n++;
  return n;
}

export function cosine(a: Vector, b: Vector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) {
    const y = large.get(k);
    if (y !== undefined) dot += x * y;
  }
  return dot;
}

/** 正規化済みベクトルの和を正規化したもの（トピックの重心） */
export function centroid(vectors: Vector[]): Vector {
  const sum: Vector = new Map();
  for (const v of vectors) {
    for (const [k, x] of v) sum.set(k, (sum.get(k) ?? 0) + x);
  }
  return normalize(sum);
}

/** 候補検索に使う、重みの大きい上位の特徴量 */
export function topFeatures(v: Vector, n: number): string[] {
  return [...v.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}
