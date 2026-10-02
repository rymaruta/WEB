/** 「今週の新発売」の種類（画面からも使うので DB に依存しない） */

export const PRODUCT_KINDS = ["food", "sweets", "drink", "gadget", "beauty", "fashion", "other"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];
export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  food: "グルメ",
  sweets: "スイーツ",
  drink: "ドリンク",
  gadget: "家電・ガジェット",
  beauty: "コスメ",
  fashion: "ファッション",
  other: "その他",
};

export type ProductItem = { topicId: number; name: string; maker: string | null; date: string; kind: ProductKind };
