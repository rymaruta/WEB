/**
 * OGP 画像（next/og）に日本語を描くためのフォントを読み込む。
 * 画像に使う文字だけを Google Fonts から取り寄せる（数 KB〜数十 KB）。
 * 取得できなかった場合は null を返し、呼び出し側で日本語なしの画像にする。
 */
export async function loadJapaneseFont(text: string, weight: 400 | 700 | 900 = 700): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].join("");
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(chars)}`,
      { signal: AbortSignal.timeout(5_000) },
    ).then((r) => (r.ok ? r.text() : ""));
    // User-Agent を付けないと TrueType 形式の URL が返る（next/og は woff2 を読めない）
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const font = await fetch(src, { signal: AbortSignal.timeout(5_000) });
    return font.ok ? await font.arrayBuffer() : null;
  } catch {
    return null;
  }
}
