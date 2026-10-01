import { normalize } from "./text";

/** 実体（人物・組織・場所・出来事の種類）で、同じ出来事かどうかを判定する */
export type Entities = { people: string[]; orgs: string[]; places: string[]; eventType: string; eventDate: string };

/** 同じ出来事とみなす時間差の上限 */
export const SAME_EVENT_WINDOW_MS = 48 * 3_600_000;

function nameSet(e: Entities): Set<string> {
  return new Set([...e.people, ...e.orgs, ...e.places].map(normalize).filter((s) => s.length >= 2));
}

/** 名前の一致。表記ゆれ（「フライドバイ」と「フライドバイ航空」など）は、短い方が長い方に含まれれば一致とみなす */
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) {
    for (const y of b) {
      if (x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)))) {
        n++;
        break;
      }
    }
  }
  return n;
}

export function isSameEvent(a: Entities, b: Entities, timeA: Date, timeB: Date): boolean {
  if (Math.abs(timeA.getTime() - timeB.getTime()) > SAME_EVENT_WINDOW_MS) return false;
  const shared = overlap(nameSet(a), nameSet(b));
  const typeA = normalize(a.eventType);
  const typeB = normalize(b.eventType);
  const sameType = typeA.length > 0 && (typeA === typeB || typeA.includes(typeB) || typeB.includes(typeA));
  const datesConflict = a.eventDate !== "不明" && b.eventDate !== "不明" && a.eventDate !== b.eventDate;
  if (datesConflict && !sameType) return false;
  return shared >= 2 || (shared >= 1 && sameType);
}
