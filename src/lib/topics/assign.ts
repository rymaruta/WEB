import { centroid, cosine, IdfModel, sharedCount, topFeatures, type Vector } from "./similarity";

export type ClusterDoc = {
  id: number;
  title: string;
  publishedAt: Date;
  topicId: number | null;
  /** 掲載元。定型見出しの判定に使う */
  publisher?: string;
};

/** 既存トピックは数値 ID、新規トピックは "new:<連番>" */
export type TopicKey = number | `new:${number}`;

export type AssignOptions = {
  /** これ以上のコサイン類似度で同じトピックとみなす */
  threshold?: number;
  /** 候補検索に使う特徴量の数 */
  candidateFeatures?: number;
  /** IDF の指数（similarity.ts の IdfModel 参照） */
  idfPower?: number;
  /** 特徴量として使う bigram の最小出現文書数（similarity.ts の IdfModel 参照） */
  minDf?: number;
  /**
   * 同一トピックとみなすのに必要な共通特徴量の最小数。
   * 短い見出し同士が1語（「福島」など）だけの一致で束ねられるのを防ぐ。
   */
  minShared?: number;
  /**
   * 候補トピックが同じ掲載元の記事だけで構成される場合の閾値。
   * 連載・定型見出し（「〇〇vs〇〇 試合記録」など）の誤結合はほぼ同一媒体内で起きるため、
   * 同一媒体どうしの結合は他媒体との結合より厳しく判定する。
   */
  samePublisherThreshold?: number;
};

// 既定値は実データ（約1,600記事・48時間分）での評価により決定。README「トピック自動まとめ」参照
export const DEFAULT_THRESHOLD = 0.3;
export const DEFAULT_IDF_POWER = 2;
export const DEFAULT_MIN_DF = 2;
export const DEFAULT_MIN_SHARED = 3;
export const DEFAULT_SAME_PUBLISHER_THRESHOLD = 0.6;

/**
 * 未割り当ての記事を、既存トピックまたは新規トピックに割り当てる。
 * 既存の割り当ては変更しない（トピック ID・URL を安定させるため）。
 * 戻り値は「未割り当てだった記事 ID → トピックキー」。
 */
export function assignTopics(docs: ClusterDoc[], options: AssignOptions = {}): Map<number, TopicKey> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const nFeatures = options.candidateFeatures ?? 8;
  const minShared = options.minShared ?? DEFAULT_MIN_SHARED;
  const samePublisherThreshold = options.samePublisherThreshold ?? DEFAULT_SAME_PUBLISHER_THRESHOLD;

  const idf = new IdfModel(
    docs.map((d) => ({ title: d.title, group: d.publisher })),
    options.idfPower ?? DEFAULT_IDF_POWER,
    options.minDf ?? DEFAULT_MIN_DF,
  );
  const vectors = new Map<number, Vector>(docs.map((d) => [d.id, idf.vector(d.title)]));

  const members = new Map<TopicKey, Vector[]>();
  const publishers = new Map<TopicKey, Set<string | undefined>>();
  const addMember = (key: TopicKey, doc: ClusterDoc) => {
    members.set(key, [...(members.get(key) ?? []), vectors.get(doc.id)!]);
    publishers.set(key, (publishers.get(key) ?? new Set()).add(doc.publisher));
  };
  for (const d of docs) {
    if (d.topicId != null) addMember(d.topicId, d);
  }

  const centroids = new Map<TopicKey, Vector>();
  const index = new Map<string, Set<TopicKey>>();
  const reindex = (key: TopicKey) => {
    const c = centroid(members.get(key)!);
    centroids.set(key, c);
    for (const f of topFeatures(c, nFeatures * 2)) {
      let set = index.get(f);
      if (!set) index.set(f, (set = new Set()));
      set.add(key);
    }
  };
  for (const key of members.keys()) reindex(key);

  const result = new Map<number, TopicKey>();
  let next = 0;
  const pending = docs
    .filter((d) => d.topicId == null)
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime() || a.id - b.id);

  for (const doc of pending) {
    const v = vectors.get(doc.id)!;
    const candidates = new Set<TopicKey>();
    for (const f of topFeatures(v, nFeatures)) {
      for (const key of index.get(f) ?? []) candidates.add(key);
    }

    let best: TopicKey | null = null;
    let bestScore = -1;
    for (const key of candidates) {
      const c = centroids.get(key)!;
      const score = cosine(v, c);
      const pubs = publishers.get(key)!;
      const onlySamePublisher = doc.publisher !== undefined && pubs.size === 1 && pubs.has(doc.publisher);
      const required = onlySamePublisher ? Math.max(threshold, samePublisherThreshold) : threshold;
      if (score >= required && score > bestScore && sharedCount(v, c) >= minShared) {
        best = key;
        bestScore = score;
      }
    }

    const key: TopicKey = best ?? `new:${next++}`;
    addMember(key, doc);
    reindex(key);
    result.set(doc.id, key);
  }

  return result;
}
