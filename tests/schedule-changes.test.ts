import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { diffSchedule } from "@/lib/schedule-changes";

const e = (key: string, date: string, title = key) => ({ key, title, date });

describe("diffSchedule（予定の変更）", () => {
  const today = "2026-10-04";
  it("同じ予定の日付が変わったら、前の日付 → 新しい日付", () => {
    expect(diffSchedule([e("作品A", "2026-11-01")], [e("作品A", "2026-12-05")], today)).toEqual([{ title: "作品A", oldDate: "2026-11-01", newDate: "2026-12-05" }]);
  });
  it("一覧から外れたこれからの予定は、新しい日付なし", () => {
    expect(diffSchedule([e("作品B", "2026-11-01")], [], today)).toEqual([{ title: "作品B", oldDate: "2026-11-01", newDate: null }]);
  });
  it("変わっていない予定・過ぎた予定は記録しない", () => {
    expect(diffSchedule([e("作品C", "2026-11-01"), e("作品D", "2026-09-30")], [e("作品C", "2026-11-01")], today)).toEqual([]);
  });
  it("月までの日付（YYYY-MM）も今月以降なら比べ、題名の表記の揺れは同じ予定とみなす", () => {
    expect(diffSchedule([e("作品 E", "2026-10")], [e("作品Ｅ", "2027-01")], today)).toEqual([{ title: "作品 E", oldDate: "2026-10", newDate: "2027-01" }]);
  });
});
