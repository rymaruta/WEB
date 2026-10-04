/**
 * 同じ話題にまとめてはいけない組み合わせ（見出しの言葉が似ていても、別の人・別の大会の出来事）。
 * 記事を話題に割り当てるとき（src/lib/topics/assign.ts）、似ている度合いが基準を超えても、ここで食い違えばまとめない。
 * 2026-10-04 の記事監査で見つかった誤結合への対策：
 * - 名字が同じで名前が違う人（小園海斗と小園健太）
 * - 年代別の代表の違い（U-21 と U-23）、男子と女子（男子U-21 となでしこ）
 * どれも見出しの言葉だけで判断する（AI は使わない）。迷う場合はまとめる側に倒さず、別の話題にする
 */

/** 4文字の漢字の並び（日本人の姓名に多い形）。先頭2文字が同じでも、組織名・地名などの言葉は人名とみなさない */
const NOT_PERSON_HEAD = /^(日本|国内|政府|東京|大阪|京都|北海|全国|米国|中国|韓国|英国|首相|大臣|代表|選手|監督|球団|会社|企業|社長|株価|日銀|自民|立憲|公明|維新|国民|共産|新型|最新|今年|今季|来季|今月|来月|前年|昨年|第一|第二|大会|試合|決勝|準決|開幕|地震|台風|大雨)/;
const HAN4 = /(?<![\p{Script=Han}])[\p{Script=Han}]{4}(?![\p{Script=Han}])/gu;

const fullNames = (title: string) => [...title.normalize("NFKC").matchAll(HAN4)].map((m) => m[0]).filter((w) => !NOT_PERSON_HEAD.test(w));

const ageGroups = (title: string) => new Set([...title.normalize("NFKC").matchAll(/U-?(\d{2})/gi)].map((m) => m[1]));
const isWomen = (t: string) => /なでしこ|女子|女性代表/.test(t);
const isMen = (t: string) => /男子/.test(t);

/**
 * 記事の見出しが、話題の見出し（members）と食い違うか。
 * - 名字が同じで名前が違う：話題の2本以上の見出しに出てくる4文字の名前と、先頭2文字が同じで残りが違う名前が記事にあり、記事には話題の名前がない
 * - 年代別の代表：記事と話題の両方に U-◯◯ があり、共通するものがない
 * - 男子と女子：一方が女子（なでしこ）、もう一方が男子
 */
export function titleConflict(title: string, members: string[]): boolean {
  if (members.length === 0) return false;
  const t = title.normalize("NFKC");
  // 名字が同じで名前が違う人
  const counts = new Map<string, number>();
  for (const m of members) for (const n of new Set(fullNames(m))) counts.set(n, (counts.get(n) ?? 0) + 1);
  const subjects = [...counts].filter(([, c]) => c >= 2).map(([n]) => n);
  for (const n of fullNames(t)) {
    if (subjects.includes(n)) continue;
    if (subjects.some((s) => s.slice(0, 2) === n.slice(0, 2) && !t.includes(s))) return true;
  }
  // 年代別の代表
  const ages = ageGroups(t);
  const memberAges = new Set(members.flatMap((m) => [...ageGroups(m)]));
  if (ages.size > 0 && memberAges.size > 0 && ![...ages].some((a) => memberAges.has(a))) return true;
  // 男子と女子
  const memberWomen = members.some(isWomen);
  const memberMen = members.some(isMen);
  if ((isWomen(t) && memberMen && !memberWomen) || (isMen(t) && memberWomen && !memberMen)) return true;
  return false;
}
