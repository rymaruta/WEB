/**
 * OGP 画像（next/og）に日本語を描くためのフォントを読み込む。
 * 画像に使う文字だけを Google Fonts から取り寄せる（数 KB〜数十 KB）。
 * 取得できなかった場合は null を返し、呼び出し側で日本語なしの画像にする。
 */
export async function loadJapaneseFont(text: string, weight: 400 | 700 | 900 = 700): Promise<ArrayBuffer | null> {
  return loadGoogleFont("Noto Sans JP", weight, text);
}

/** 取り寄せ全体（CSS とフォント本体）の上限。これを超えたら諦めて null を返す */
const FONT_TIMEOUT_MS = 10_000;

/** Google Fonts の任意のフォントを、使う文字だけ取り寄せる */
export async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].sort().join("");
  // fetch の signal だけでは本文の読み込みが止まったときに戻らないことがあるため、全体にも上限を設ける
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FONT_TIMEOUT_MS).unref?.());
  const load = async (): Promise<ArrayBuffer | null> => {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(chars)}`,
      { signal: AbortSignal.timeout(FONT_TIMEOUT_MS), cache: "no-store" },
    ).then((r) => (r.ok ? r.text() : ""));
    // User-Agent を付けないと TrueType 形式の URL が返る（next/og は woff2 を読めない）
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const font = await fetch(src, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS), cache: "no-store" });
    return font.ok ? await font.arrayBuffer() : null;
  };
  const result = await Promise.race([load().catch(() => null), timeout]);
  if (!result) console.error(JSON.stringify({ event: "font", level: "error", family, weight, chars: chars.length }));
  return result;
}
