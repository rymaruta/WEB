/** カードと投稿本文の文字数の数え方。全角を 1、半角英数字・記号を 0.5 として数える */
export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const half = (c >= 0x20 && c <= 0x7e) || (c >= 0xff61 && c <= 0xff9f);
    w += half ? 0.5 : 1;
  }
  return w;
}

/** 比較用に正規化する（全角英数字→半角、小文字化、空白と桁区切りの除去） */
export function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s,，]/g, "");
}
