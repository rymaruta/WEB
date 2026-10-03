/** 話題の写真（自由利用ライセンス）。url は画像、page は作者・ライセンスが載った Commons のページ、credit は「作者 / ライセンス」 */
export type Photo = { url: string; page: string; credit: string };

/** 保存した写真の値を読む（形が違えば null） */
export function readPhoto(value: unknown): Photo | null {
  const v = value as Partial<Photo> | null;
  return v && typeof v.url === "string" && typeof v.page === "string" && typeof v.credit === "string" ? { url: v.url, page: v.page, credit: v.credit } : null;
}
