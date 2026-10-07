/** 官公庁の発表（prisma/catalog.ts の官公庁のフィード）。企業の発表と区別して「官公庁の発表」と表示する */
export const GOVERNMENT_PUBLISHERS = new Set(["首相官邸", "国土交通省", "総務省", "消防庁", "文部科学省", "農林水産省", "法務省", "警察庁", "金融庁", "財務省", "総務省統計局", "デジタル庁", "IPA（情報処理推進機構）", "気象庁"]);

export const isGovernment = (publisher: string) => GOVERNMENT_PUBLISHERS.has(publisher);

/** 発表の種類の表示 */
export const pressLabel = (publisher: string) => (isGovernment(publisher) ? "官公庁の発表" : "プレスリリース");
