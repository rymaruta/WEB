/**
 * 話題・ランキングに出さない見出しの判定（DB に依存しない）。
 * - 定型の記事：毎日同じ形で出る占い・予告先発・公示・試合速報・セール情報など（出来事ではない）
 * - 弱い見出し：語を並べただけで、何が起きたかが書かれていない（連載の欄の名前など。例「プロ野球・ひとこと」）
 */

const ROUTINE = new RegExp(
  [
    "運勢",
    "占い",
    "星座ランキング",
    "九星気学",
    "予告先発",
    "公示[（(]",
    "プロ野球速報",
    "試合開始前",
    "・ひとこと$",
    "セール情報",
    "お買い得",
    "本日みつけた",
  ].join("|"),
);

/** 定型の記事の見出しか */
export const isRoutineTitle = (title: string) => ROUTINE.test(title.normalize("NFKC"));

/**
 * 何が起きたかが書かれていない、連載の欄の名前のような見出しか（「・」で語を並べただけで、助詞・句読点・数字を含まない12文字以内）。
 * 「円安加速」のような短い見出しは出来事を表すので、「・」のないものは弱いとみなさない。
 * 助詞は語の中に出にくいもの（が・を・に・で・へ・は）だけで見る（「ひとこと」の「と」などを助詞とみなさないように）
 */
export function isWeakHeadline(title: string): boolean {
  const s = title.normalize("NFKC").trim();
  return s.length <= 12 && /[・|｜]/.test(s) && !/[がをにでへは、。!?「」\d]/.test(s);
}

/** 話題の一覧に出さない話題か（表示する見出しで判定する） */
export const isUnlistable = (title: string) => isRoutineTitle(title) || isWeakHeadline(title);
